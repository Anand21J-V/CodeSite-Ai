# 🤖 CodeSite-AI

> An agentic AI-powered web app builder — your local Lovable clone.

CodeSite-AI takes a plain English description of the web app you want and autonomously plans, architects, and codes a complete, ready-to-open HTML/CSS/JS project — no human intervention required.

---

## ✨ What It Does

You describe an app. CodeSite-AI builds it.

Under the hood, a multi-agent LangGraph pipeline powered by **Groq's Llama 3.3 70B** model handles the entire software development lifecycle:

1. **Planner** — Interprets your prompt and produces a high-level project plan (name, description, tech stack, features, files).
2. **Architect** — Breaks the plan into ordered, dependency-aware implementation tasks, one per file.
3. **Coder** — Iterates through each task, reading existing files for context and writing the final code using sandboxed file tools.

All generated files land in `generated_project/` and are ready to open in a browser.

---

## 🏗️ Architecture

```
User Prompt
    │
    ▼
┌─────────────┐
│   Planner   │  → Plan (name, description, tech stack, features, files)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Architect  │  → TaskPlan (ordered list of ImplementationTasks)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Coder    │  → Loops through each task, writes files to generated_project/
└──────┬──────┘
       │
       ▼
  generated_project/
  ├── index.html
  ├── style.css
  └── script.js
```

The graph is built with [LangGraph](https://github.com/langchain-ai/langgraph) and uses a conditional loop on the `coder` node so that it keeps executing until all implementation steps are complete.

---

## 📁 Project Structure

```
CodeSite-Ai/
├── agent/
│   ├── graph.py          # LangGraph pipeline: planner → architect → coder (loop)
│   ├── prompts.py        # System & user prompts for each agent
│   ├── states.py         # Pydantic schemas: Plan, TaskPlan, ImplementationTask, CoderState
│   └── tools.py          # Sandboxed file tools: write_file, read_file, list_files, get_current_directory
├── generated_project/    # Output directory — all AI-generated app files land here
│   ├── index.html
│   ├── style.css
│   └── script.js
├── main.py               # CLI entry point
├── requirements.txt      # Python dependencies
├── .env                  # API keys (not committed to production)
└── LICENSE
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- A [Groq API key](https://console.groq.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/CodeSite-Ai.git
cd CodeSite-Ai
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

> ⚠️ **Never commit your `.env` file or expose your API key publicly.**

### 4. Run the App Builder

```bash
python main.py
```

You'll be prompted to enter a project description:

```
Enter your project prompt: Build a colorful modern to-do app in HTML, CSS, and JS
```

The agent pipeline will run automatically. Once complete, open `generated_project/index.html` in your browser.

### Optional: Custom Recursion Limit

For complex projects with many files, you can raise the recursion limit:

```bash
python main.py --recursion-limit 200
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| LLM | [Groq](https://groq.com/) — Llama 3.3 70B Versatile |
| Agent Orchestration | [LangGraph](https://github.com/langchain-ai/langgraph) |
| LLM Framework | [LangChain](https://github.com/langchain-ai/langchain) |
| Data Validation | [Pydantic v2](https://docs.pydantic.dev/) |
| Environment Config | [python-dotenv](https://github.com/theskumar/python-dotenv) |
| Output | Plain HTML / CSS / JS (no build step required) |

---

## 🛠️ Agent Details

### Planner Agent

- **Input:** Raw user prompt string
- **Output:** `Plan` — structured object containing `name`, `description`, `techstack`, `features`, and `files` (list of `{path, purpose}`)
- **Method:** Structured output via `llm.with_structured_output(Plan)`

### Architect Agent

- **Input:** `Plan` (serialized as JSON)
- **Output:** `TaskPlan` — ordered list of `ImplementationTask` objects, each containing a `filepath` and a detailed `task_description`
- **Method:** Structured output via `llm.with_structured_output(TaskPlan)`, with dependency-aware task ordering

### Coder Agent

- **Input:** `CoderState` tracking `task_plan` and `current_step_idx`
- **Output:** Written files under `generated_project/`, updated `CoderState`
- **Method:** ReAct agent with access to sandboxed file tools
- **Loop:** The LangGraph conditional edge re-routes back to `coder` until all steps are complete

### File Tools (Sandboxed)

All tools are restricted to `generated_project/` via path validation — no writes outside the project root are permitted.

| Tool | Description |
|---|---|
| `write_file(path, content)` | Writes content to a file |
| `read_file(path)` | Reads an existing file (returns `""` if not found) |
| `list_files(directory)` | Lists all files recursively |
| `get_current_directory()` | Returns the project root path |

---

## 📝 Example Prompts

```
Build a colorful modern to-do app in HTML, CSS, and JS
```

```
Create a simple password generator with options for length, uppercase, numbers, and symbols
```

```
Make a responsive personal portfolio page with a hero section, about, and contact form
```

```
Build a pomodoro timer with start/pause/reset and a visual countdown
```

---

## ⚙️ Configuration

| Variable | Description | Default |
|---|---|---|
| `GROQ_API_KEY` | Your Groq API key (required) | — |
| `--recursion-limit` | Max LangGraph recursion steps | `100` |

---

## 🔒 Security Notes

- File tools enforce a **sandbox boundary** — all read/write operations are validated against `generated_project/` and will raise `ValueError` on path traversal attempts.
- The `.env` file is **excluded from version control**. Never hardcode API keys in source files.
- The `run_cmd` tool is defined but **not exposed** to the coder agent by default, limiting shell execution.

---

## 🗺️ Roadmap

- [ ] Support multi-file backend projects (Flask, FastAPI)
- [ ] Add a streaming UI for real-time agent progress
- [ ] Implement a review/critique agent for self-correction
- [ ] Support React/TypeScript output with a build step
- [ ] Add conversation-style iteration ("now add dark mode")
- [ ] Web UI frontend (Gradio or Streamlit)

---

## 🤝 Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a pull request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the terms found in the [LICENSE](LICENSE) file.

---

<p align="center">Built with LangGraph · Powered by Groq · Inspired by Lovable</p>
