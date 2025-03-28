# sanity-check

Pre-commit hook that uses AI to check for mistakes leading to security issues

## Installation

1. npm install --save-dev sanity-check
2. `cp node_modules/@iteam/sanity-check/pre-commit .git/hooks/pre-commit` (or add it's content to a
   pre-existing pre-commit)
3. Add an .env file in root of your repository, with the key `CLAUDE_API_KEY` set to your api key.
