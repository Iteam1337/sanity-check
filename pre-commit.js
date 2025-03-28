#!/usr/bin/env node

const { execSync } = require("child_process");
const https = require("https");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

// Configuration
const config = {
  model: "claude-3-opus-20240229",
  apiEndpoint: "api.anthropic.com",
};

function getGitRoot() {
  try {
    return execSync("git rev-parse --show-toplevel").toString().trim();
  } catch (error) {
    console.error("Error finding git root:", error.message);
    process.exit(1);
  }
}

function loadEnvFile() {
  try {
    const gitRoot = getGitRoot();
    const envPath = path.join(__dirname, ".env");
    const envContent = fs.readFileSync(envPath, "utf8");
    const envVars = {};

    envContent.split("\n").forEach((line) => {
      const [key, value] = line.split("=").map((str) => str.trim());
      if (key && value) {
        envVars[key] = value;
      }
    });

    return envVars;
  } catch (error) {
    console.error("Error reading .env file:", error.message);
    process.exit(1);
  }
}

// Load environment variables
const envVars = loadEnvFile();
config.apiKey = envVars.CLAUDE_API_KEY;

if (!config.apiKey) {
  console.error("CLAUDE_API_KEY not found in .env file");
  process.exit(1);
}

function getStagedChanges() {
  try {
    return execSync("git diff --cached --name-only").toString().trim();
  } catch (error) {
    console.error("Error getting staged changes:", error.message);
    process.exit(1);
  }
}

function getDiffContent() {
  try {
    return execSync("git diff --cached").toString();
  } catch (error) {
    console.error("Error getting diff content:", error.message);
    process.exit(1);
  }
}

function makeApiRequest(prompt) {
  const options = {
    hostname: config.apiEndpoint,
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          // Check if we have a valid response with content
          if (
            !response ||
            !response.content ||
            !Array.isArray(response.content) ||
            response.content.length === 0
          ) {
            reject(new Error("Invalid API response structure"));
            return;
          }

          resolve(response);
        } catch (error) {
          reject(new Error("Failed to parse API response"));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(
      JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
      })
    );
    req.end();
  });
}

function askForConfirmation() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Do you want to proceed with the commit? (y/n) ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function main() {
  try {
    // Get staged changes
    const stagedFiles = getStagedChanges();

    // Skip if no files are staged
    if (!stagedFiles) {
      process.exit(0);
    }

    // Get the diff content
    const diffContent = getDiffContent();

    // Prepare the prompt for Claude
    const prompt = `
        You are a code review assistant specializing in identifying security vulnerabilities and code quality issues in git diffs. Your task is to analyze the following git diff and provide a detailed report on any potential security issues or other significant problems introduced by the code changes.\n\nHere is the git diff to analyze:\n\n<git_diff>\n{{GIT_DIFF}}\n</git_diff>\n\nPlease follow these steps to analyze the git diff:\n\n1. Security Analysis:\n   - Look for potential security vulnerabilities introduced by the changes, such as:\n     a) Injection flaws (SQL injection, command injection, etc.)\n     b) Authentication and authorization issues\n     c) Sensitive data exposure\n     d) Cross-site scripting (XSS) vulnerabilities\n     e) Insecure cryptographic practices\n     f) Potential for privilege escalation\n   - Pay special attention to changes in input validation, data handling, and authentication mechanisms.\n\n2. Code Quality Analysis:\n   - Identify any issues that could impact the overall quality and maintainability of the code, such as:\n     a) Introduction of code smells or anti-patterns\n     b) Violations of SOLID principles or other best practices\n     c) Potential performance issues\n     d) Inconsistencies in coding style or naming conventions\n     e) Lack of proper error handling or logging\n     f) Duplication of code or logic\n\n3. Reporting Format:\n   For each issue found, provide the following information in your report:\n   <issue>\n   <type>Security/Code Quality</type>\n   <severity>High/Medium/Low</severity>\n   <description>Detailed description of the issue</description>\n   <location>File name and line number(s) where the issue occurs</location>\n   <recommendation>Suggested fix or mitigation strategy</recommendation>\n   </issue>\n\n4. Summary:\n   After listing all individual issues, provide a brief summary of the overall impact of the changes, including:\n   - The number of security issues found (categorized by severity)\n   - The number of code quality issues found (categorized by severity)\n   - An assessment of the overall risk introduced by these changes\n   - Any positive changes or improvements noticed in the diff\n\nPlease begin your analysis now and present your findings using the specified format. If no issues are found, state that explicitly in your report.\nThe output should be a simple conclusion if these changes should be commited or not, the full report should not be output
    17:33
    Formatterad:
    You are a code review assistant specializing in identifying security vulnerabilities and code quality issues in git diffs. Your task is to analyze the following git diff and provide a detailed report on any potential security issues or other significant problems introduced by the code changes.

    Here is the git diff to analyze:

    <git_diff>
    ${diffContent}
    </git_diff>

    Please follow these steps to analyze the git diff:

    1. Security Analysis:
      - Look for potential security vulnerabilities introduced by the changes, such as:
        a) Injection flaws (SQL injection, command injection, etc.)
        b) Authentication and authorization issues
        c) Sensitive data exposure
        d) Cross-site scripting (XSS) vulnerabilities
        e) Insecure cryptographic practices
        f) Potential for privilege escalation
      - Pay special attention to changes in input validation, data handling, and authentication mechanisms.

    2. Code Quality Analysis:
      - Identify any issues that could impact the overall quality and maintainability of the code, such as:
        a) Introduction of code smells or anti-patterns
        b) Violations of SOLID principles or other best practices
        c) Potential performance issues
        d) Inconsistencies in coding style or naming conventions
        e) Lack of proper error handling or logging
        f) Duplication of code or logic

    3. Reporting Format:
      For each issue found, provide the following information in your report:
      <issue>
      <type>Security/Code Quality</type>
      <severity>High/Medium/Low</severity>
      <description>Detailed description of the issue</description>
      <location>File name and line number(s) where the issue occurs</location>
      <recommendation>Suggested fix or mitigation strategy</recommendation>
      </issue>

    4. Summary:
      After listing all individual issues, provide a brief summary of the overall impact of the changes, including:
      - The number of security issues found (categorized by severity)
      - The number of code quality issues found (categorized by severity)
      - An assessment of the overall risk introduced by these changes
      - Any positive changes or improvements noticed in the diff

    Please begin your analysis now and present your findings using the specified format. If no issues are found, state that explicitly in your report.
    The output should be a simple conclusion if these changes should be commited or not, the full report should not be output

    `;

    // Log the request details
    console.log("\nSanity checking diff with Claude:");
    console.log("Model:", config.model);
    console.log("Prompt length:", prompt.length, "characters");
    console.log("API Endpoint:", config.apiEndpoint);
    console.log("----------------------------------------");

    // Make the API request
    const response = await makeApiRequest(prompt);

    // Safely access the feedback text
    const feedback = response.content[0]?.text;
    if (!feedback) {
      throw new Error("No feedback received from Claude");
    }

    // Display the feedback
    console.log("\nClaude's Review:");
    console.log(feedback);

    // Check for critical issues
    if (feedback.includes("[CRITICAL]")) {
      console.log(
        "\nCritical issues found. Please address them before committing."
      );
      // Ask for user confirmation
      const shouldProceed = await askForConfirmation();
      if (!shouldProceed) {
        console.log("\nCommit aborted.");
        process.exit(1);
      }
      process.exit(1);
    }
    console.log("\nCommit approved. Committing...");

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
