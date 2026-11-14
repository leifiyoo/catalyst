# GitHub Actions Workflows

## AI Issue Triage

The `ai-triage.yml` workflow automatically analyzes newly opened issues using AI to determine if they are bugs or user errors.

### How It Works

1. **Trigger**: Automatically runs when a new issue is opened
2. **AI Analysis**: Sends the issue to an AI agent with comprehensive project context
3. **Classification**: The AI determines if it's a bug, user error, or needs more information
4. **Response**: Posts a detailed analysis as a comment on the issue
5. **Labeling**: Automatically adds the "bug" label if a bug is confirmed

### AI Agent Capabilities

The AI agent is configured with:

- **Project Knowledge**: Full context about Catalyst (Electron + React + TypeScript stack)
- **Architecture Understanding**: Knowledge of the project structure and dependencies
- **Technology Expertise**: Deep understanding of Electron, React, Vite, and related tools
- **Error Analysis**: Ability to analyze error messages and stack traces
- **Bug Classification**: Determines if issues are bugs or user errors

### Response Format

The AI provides structured responses:

#### Bug Confirmed
```
[BUG CONFIRMED]
- Explanation of the bug
- Likely location in codebase
- Suggested fixes with code examples
- Reproduction steps
- Related dependencies/configuration notes
```

#### User Error
```
[USER ERROR]
- Explanation why it's not a bug
- What the user did wrong
- Step-by-step resolution instructions
- Best practices to avoid similar issues
- Documentation references
```

#### Needs More Info
```
[NEEDS MORE INFO]
- List of specific questions
- Why additional details are needed
- Guidance on how to gather information
```

### Configuration

The workflow requires the following secret:
- `OPENROUTER_API_KEY`: API key for OpenRouter (AI service)

### Permissions

The workflow requires:
- `issues: write` - To comment on and label issues
- `contents: read` - To checkout the repository

### Model

Currently uses: `openrouter/pony-alpha` with reasoning enabled

### Error Handling

If the AI service fails or returns an error, the workflow will:
- Post an error message explaining the issue
- Include the raw API response for debugging
- Not apply any labels
- Allow manual review of the issue
