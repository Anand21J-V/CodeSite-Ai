# Importing the Libraries
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from prompts import planner_agent_prompt, architect_agent_prompt, coder_agent_prompt
from states import Planner_schema, TaskPlan, CoderState
from langgraph.graph import StateGraph, START, END
# from langchain.globals import set_verbose, set_debug
from agent.tools import write_file, read_file, get_current_directory, list_files
from langchain.agents import create_agent

load_dotenv()

# set_debug(True)
# set_verbose(True)

# Loading the Model
llm = ChatGroq(model="llama-3.3-70b-versatile")
# model = openai/gpt-oss-120b

# Planner Agent
def planner_agent(state: dict) -> dict:
    user_prompt = state["user_prompt"]
    response = llm.with_structured_output(Planner_schema).invoke(planner_agent_prompt(user_prompt))
    if response is None:
        raise ValueError("Planner did not return a Valid Response")
    
    return {"plan": response}

# Architecture Agent
def architect_agent(state: dict) -> dict:
    plan = state["plan"]
    response = llm.with_structured_output(TaskPlan).invoke(architect_agent_prompt(plan)) 
    if response is None:
        raise ValueError("Architect did not return a Valid Response")
    
    # For Context Engineering adding the previous State As well
    response.plan = plan

    return {"task_plan": response}

# Coder Agent
def coder_agent(state: dict) -> dict:
    """LangGraph tool-using coder agent."""
    coder_state: CoderState = state.get("coder_state")
    if coder_state is None:
        coder_state = CoderState(task_plan=state["task_plan"], current_step_idx=0)

    steps = coder_state.task_plan.implementation_steps
    if coder_state.current_step_idx >= len(steps):
        return {"coder_state": coder_state, "status": "DONE"}

    current_task = steps[coder_state.current_step_idx]
    existing_content = read_file.run(current_task.filepath)

    system_prompt = coder_agent_prompt()
    user_prompt = (
        f"Task: {current_task.task_description}\n"
        f"File: {current_task.filepath}\n"
        f"Existing content:\n{existing_content}\n"
        "Use write_file(path, content) to save your changes."
    )

    coder_tools = [read_file, write_file, list_files, get_current_directory]
    react_agent = create_agent(llm, coder_tools)

    react_agent.invoke({"messages": [{"role": "system", "content": system_prompt},
                                     {"role": "user", "content": user_prompt}]})

    coder_state.current_step_idx += 1
    return {"coder_state": coder_state}


# State of the Graph
graph = StateGraph(dict)

# Adding the Nodes
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent)

# Connecting the Nodes
graph.add_edge(start_key="planner", end_key="architect")
graph.add_edge(start_key="architect", end_key="coder")

# Entry point of the Graph
graph.set_entry_point("planner")

# Compiling the graph
agent = graph.compile()

if __name__ == "__main__":
    user_prompt = "Create a simple calculator web Application"
    result = agent.invoke({"user_prompt": user_prompt})

    print(result)