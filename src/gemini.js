import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

export class GeminiAssistant {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
    this.history = [];
  }

  updateApiKey(newApiKey) {
    this.apiKey = newApiKey;
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  updateModel(newModel) {
    this.model = newModel;
  }

  async confirmAction(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise((resolve) => {
      rl.question(`[WARNING] ${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });
  }

  async executeTool(name, args) {
    try {
      switch (name) {
        case 'create_file': {
          const dir = path.dirname(args.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(args.path, args.content, 'utf-8');
          return `Success: File ${args.path} created/written.`;
        }
        case 'read_file': {
          if (fs.existsSync(args.path)) {
            return fs.readFileSync(args.path, 'utf-8');
          }
          return `Error: File ${args.path} not found.`;
        }
        case 'list_directory': {
          const target = args.path || '.';
          if (fs.existsSync(target)) {
            return JSON.stringify(fs.readdirSync(target));
          }
          return `Error: Directory ${target} not found.`;
        }
        case 'delete_path': {
          if (!fs.existsSync(args.path)) return `Error: Path ${args.path} does not exist.`;
          const confirmed = await this.confirmAction(`AI wants to delete path: ${args.path}`);
          if (!confirmed) return 'Operation cancelled by user.';
          
          const stat = fs.statSync(args.path);
          if (stat.isDirectory()) {
            fs.rmSync(args.path, { recursive: true, force: true });
            return `Success: Directory ${args.path} deleted.`;
          } else {
            fs.unlinkSync(args.path);
            return `Success: File ${args.path} deleted.`;
          }
        }
        default:
          return `Error: Unknown tool ${name}`;
      }
    } catch (e) {
      return `Error executing tool: ${e.message}`;
    }
  }

  async sendMessage(userInput) {
    try {
      this.history.push({ role: 'user', parts: [{ text: userInput }] });

      const tools = [{
        functionDeclarations: [
          {
            name: 'create_file',
            description: 'Create or overwrite a file with content. Automatically creates parent directories.',
            parametersJsonSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Relative file path' },
                content: { type: 'string', description: 'File content' }
              },
              required: ['path', 'content']
            }
          },
          {
            name: 'read_file',
            description: 'Read the contents of a local file.',
            parametersJsonSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Relative file path' }
              },
              required: ['path']
            }
          },
          {
            name: 'list_directory',
            description: 'List contents of a directory.',
            parametersJsonSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path, defaults to current directory' }
              }
            }
          },
          {
            name: 'delete_path',
            description: 'Delete a file or an entire directory recursively. Requires user confirmation.',
            parametersJsonSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File or directory path to delete' }
              },
              required: ['path']
            }
          }
        ]
      }];

      let response = await this.client.models.generateContent({
        model: this.model,
        contents: this.history,
        config: { tools }
      });

      while (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        const parts = response.candidates[0].content.parts;
        const functionCallPart = parts.find(p => p.functionCall);
        
        if (!functionCallPart) break;

        const call = functionCallPart.functionCall;
        console.log(`\n[Executing Tool: ${call.name} with args ${JSON.stringify(call.args)}]`);
        const toolResult = await this.executeTool(call.name, call.args);

        this.history.push(response.candidates[0].content);
        this.history.push({
          role: 'user',
          parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }]
        });

        response = await this.client.models.generateContent({
          model: this.model,
          contents: this.history,
          config: { tools }
        });
      }

      const replyText = response.text || '';
      this.history.push({ role: 'model', parts: [{ text: replyText }] });
      return replyText;
    } catch (error) {
      this.history.pop();
      throw error;
    }
  }
}

