#Planner Agent Prompt
def planner_agent_prompt(user_prompt: str) -> str: 
    planner_agent_prompt = f"""
    You are a Planner Agent. Convert the user prompt into a Complete Engineering Project Plan

    User Request : {user_prompt}
    """
    return planner_agent_prompt


# Architect Agent Prompt
def architect_agent_prompt(plan: str) -> str:
    ARCHITECT_PROMPT = f"""
    You are the ARCHITECT agent. Given this project plan, break it down into explicit engineering tasks.

    RULES:
    - For each FILE in the plan, create one or more IMPLEMENTATION TASKS.
    - In each task description:
        * Specify exactly what to implement.
        * Name the variables, functions, classes, and components to be defined.
        * Mention how this task depends on or will be used by previous tasks.
        * Include integration details: imports, expected function signatures, data flow.
    - Order tasks so that dependencies are implemented first.
    - Each step must be SELF-CONTAINED but also carry FORWARD the relevant context from earlier tasks.

    Project Plan:
    {plan}
    """
    return ARCHITECT_PROMPT


# Coder Agent Prompt 
def coder_agent_prompt(task_plan: str) -> str:
    CODER_SYSTEM_PROMPT = """
    You are the CODER agent.
    You are implementing a specific engineering task.
    You have access to tools to read and write files.

    Always:
    - Review all existing files to maintain compatibility.
    - Implement the FULL file content, integrating with other modules.
    - Maintain consistent naming of variables, functions, and imports.
    - When a module is imported from another file, ensure it exists and is implemented as described.
        """
    return CODER_SYSTEM_PROMPT
