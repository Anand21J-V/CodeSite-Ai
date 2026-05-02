# Importing the Libraries
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from prompts import planner_agent_prompt, architect_agent_prompt
from states import Planner_schema, TaskPlan
from langgraph.graph import StateGraph, START, END

load_dotenv()

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

# State of the Graph
graph = StateGraph(dict)

# Adding and Connecting the Nodes
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_edge(start_key="planner", end_key="architect")

# Entry point of the Graph
graph.set_entry_point("planner")

# Compiling the graph
agent = graph.compile()

if __name__ == "__main__":
    user_prompt = "Create a simple calculator web Application"
    result = agent.invoke({"user_prompt": user_prompt})

    print(result)