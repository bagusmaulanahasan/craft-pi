import readline from 'readline';
import fs from 'fs';
import { GeminiAssistant } from './gemini.js';
import { loadConfig, saveConfig } from './config.js';

const AVAILABLE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
];

export async function startRepl() {
  let config = loadConfig();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  if (!config.apiKey) {
    console.log('=== PHP CRUD AI CLI Setup ===');
    const key = await question('Enter your Gemini API Key: ');
    if (!key.trim()) {
      console.log('API Key cannot be empty.');
      rl.close();
      process.exit(1);
    }
    config.apiKey = key.trim();
    saveConfig(config);
    console.log('API Key saved successfully!\n');
  }

  const assistant = new GeminiAssistant(config.apiKey, config.model);

  console.log(`=== PHP CRUD AI Assistant (Model: ${config.model}) ===`);
  console.log('Commands: /models, /newpi, /cat <file>, exit\n');

  const promptUser = async () => {
    rl.question('\nphpcrud> ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === 'exit' || trimmed === 'quit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }

      if (trimmed === '') {
        return promptUser();
      }

      if (trimmed === '/models') {
        console.log('\nAvailable Models:');
        AVAILABLE_MODELS.forEach((m, idx) => {
          const active = m === assistant.model ? ' (active)' : '';
          console.log(`${idx + 1}. ${m}${active}`);
        });
        const choice = await question('Select model number or press enter to cancel: ');
        const index = parseInt(choice.trim(), 10) - 1;
        if (index >= 0 && index < AVAILABLE_MODELS.length) {
          assistant.updateModel(AVAILABLE_MODELS[index]);
          config.model = AVAILABLE_MODELS[index];
          saveConfig(config);
          console.log(`Model switched to: ${assistant.model}`);
        }
        return promptUser();
      }

      if (trimmed === '/newpi') {
        const newKey = await question('Enter new Gemini API Key: ');
        if (newKey.trim()) {
          assistant.updateApiKey(newKey.trim());
          config.apiKey = newKey.trim();
          saveConfig(config);
          console.log('API Key updated successfully!');
        } else {
          console.log('Operation cancelled. API key unchanged.');
        }
        return promptUser();
      }

      if (trimmed.startsWith('/cat ')) {
        const filePath = trimmed.replace('/cat', '').trim();
        try {
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            console.log(`\n[Loaded file: ${filePath}]`);
            const promptMsg = `Analyze this code from ${filePath}:\n\n\`\`\`php\n${fileContent}\n\`\`\``;
            process.stdout.write('AI thinking...');
            const reply = await assistant.sendMessage(promptMsg);
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            console.log(reply);
          } else {
            console.log(`File not found: ${filePath}`);
          }
        } catch (err) {
          console.log(`Error reading file: ${err.message}`);
        }
        return promptUser();
      }

      try {
        process.stdout.write('AI thinking...');
        const reply = await assistant.sendMessage(trimmed);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        // Filter out markdown code blocks from being printed to CMD to keep it clean
        const cleanedReply = reply.replace(/```[\s\S]*?```/g, '[File/Code generated and saved successfully]').trim();
        console.log(cleanedReply);
      } catch (err) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(`Error: ${err.message}`);
      }

      promptUser();
    });
  };

  promptUser();
}
