// =============================================================
// Railway Variable Manager - Dashboard থেকে API Key ব্যবস্থাপনা
// Railway GraphQL API ব্যবহার করে env var সেট/ডিলিট করে
// API key কখনো code বা settings.json-এ সংরক্ষিত হয় না
// =============================================================
'use strict';

const https = require('https');

// Railway project তথ্য (hardcode করা ঠিক আছে — এগুলো secret না)
const RAILWAY_GRAPHQL = 'backboard.railway.app';
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || 'cc0cffbe-681d-4a6b-8e70-e9222c102fd8';
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID || 'e55d7b2f-db57-4d4f-a5a3-a9c74faf48d1';
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID || '00797802-3b8e-4ba5-be92-556c74d49036';

// Railway API Token (Railway dashboard > Settings > Tokens থেকে নিন)
function getRailwayToken() {
  return process.env.RAILWAY_TOKEN || null;
}

// GraphQL request করো
function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const token = getRailwayToken();
    if (!token) return reject(new Error('RAILWAY_TOKEN সেট নেই'));

    const body = JSON.stringify({ query, variables });
    const options = {
      hostname: RAILWAY_GRAPHQL,
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) reject(new Error(parsed.errors[0].message));
          else resolve(parsed.data);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ===== API Key সেট করো =====
async function setVariable(name, value) {
  const query = `
    mutation variableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }
  `;
  await graphql(query, {
    input: { projectId: PROJECT_ID, serviceId: SERVICE_ID, environmentId: ENV_ID, name, value }
  });
  return true;
}

// ===== API Key ডিলিট করো =====
async function deleteVariable(name) {
  const query = `
    mutation variableDelete($input: VariableDeleteInput!) {
      variableDelete(input: $input)
    }
  `;
  await graphql(query, {
    input: { projectId: PROJECT_ID, serviceId: SERVICE_ID, environmentId: ENV_ID, name }
  });
  return true;
}

// ===== সব Variables পাও (masked) =====
async function getVariables() {
  const query = `
    query variables($projectId: String!, $serviceId: String!, $environmentId: String!) {
      variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
    }
  `;
  const data = await graphql(query, {
    projectId: PROJECT_ID,
    serviceId: SERVICE_ID,
    environmentId: ENV_ID
  });

  // শুধু LLM সংক্রান্ত variables দেখাও, value masked করো
  const vars = data.variables || {};
  const llmKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'LLM_PROVIDER'];
  const masked = {};
  llmKeys.forEach(k => {
    if (vars[k]) masked[k] = '****' + String(vars[k]).slice(-6);
  });
  return masked;
}

// ===== Railway Token আছে কিনা =====
function hasToken() {
  return !!getRailwayToken();
}

module.exports = { setVariable, deleteVariable, getVariables, hasToken };
