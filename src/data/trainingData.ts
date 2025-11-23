/**
 * Comprehensive n8n training data and knowledge base
 * Covers workflows, troubleshooting, nodes, and best practices
 */

export interface TrainingItem {
    category: 'troubleshooting' | 'how-to' | 'best-practices' | 'nodes' | 'integrations' | 'security' | 'performance';
    keywords: string[];
    question: string;
    answer: string;
    relatedTopics: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Comprehensive training data
 */
export const TRAINING_DATA: TrainingItem[] = [
    // TROUBLESHOOTING
    {
        category: 'troubleshooting',
        keywords: ['error', 'webhook', 'test', 'timeout', '502'],
        question: 'My webhook test is failing with "Workflow could not be started" or timeout errors',
        answer: `Common webhook test failures and solutions:

**1. Webhook Not Active**
- Ensure workflow is ACTIVATED (toggle in top-right)
- Inactive workflows cannot receive webhook requests

**2. Timeout During Test**
- Test webhook has 120-second timeout
- Use production URL for longer-running workflows
- Add a quick "Respond to Webhook" node early in flow

**3. 502 Bad Gateway**
- n8n instance may be overloaded or restarting
- Check if n8n service is running properly
- Review server logs for memory/CPU issues

**4. Authentication Failures**
- Verify webhook authentication settings (if enabled)
- Check headers, query parameters, or body auth
- Test with authentication disabled first

**Fix: Add Immediate Response**
\`\`\`json
{
  "name": "Respond to Webhook",
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "respondWith": "text",
    "responseBody": "=Received! Processing..."
  }
}
\`\`\`
Place this node early to acknowledge receipt before processing.`,
        relatedTopics: ['webhooks', 'workflow activation', 'timeouts'],
        difficulty: 'beginner'
    },

    {
        category: 'troubleshooting',
        keywords: ['http request', 'cors', 'error', '401', '403'],
        question: 'HTTP Request node returns 401 Unauthorized or 403 Forbidden errors',
        answer: `Authentication and permission errors in HTTP Request:

**401 Unauthorized - Authentication Required**
1. **Missing Credentials**: Add credential in HTTP Request node
2. **Expired Token**: Refresh OAuth token or regenerate API key
3. **Wrong Auth Type**: Verify if API uses Bearer, Basic, or Custom auth
4. **Header Auth**: Some APIs need auth in custom headers

**403 Forbidden - No Permission**
1. **Insufficient Scope**: API key/token lacks required permissions
2. **IP Whitelist**: Your n8n server IP not in API's allowed list
3. **Rate Limit**: Too many requests, wait before retrying
4. **Incorrect Endpoint**: Check API documentation for correct URL

**Solutions:**
\`\`\`javascript
// For Bearer Token in Headers
{
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  }
}

// For Custom Authentication
{
  "headers": {
    "X-API-Key": "YOUR_KEY",
    "User-Agent": "n8n-workflow"
  }
}
\`\`\`

**Debug Steps:**
1. Test same request in Postman/curl first
2. Enable "Response" toggle in HTTP Request to see full response
3. Check API provider docs for exact auth requirements
4. Verify credential creation in n8n credentials panel`,
        relatedTopics: ['authentication', 'HTTP requests', 'API integration'],
        difficulty: 'intermediate'
    },

    {
        category: 'troubleshooting',
        keywords: ['code node', 'error', 'undefined', 'javascript', 'syntax'],
        question: 'Code node shows "Cannot read property of undefined" or syntax errors',
        answer: `Common Code node errors and fixes:

**1. Data Access Errors**
\`\`\`javascript
// ❌ WRONG - crashes if field doesn't exist
const value = items[0].json.user.email;

// ✅ CORRECT - safe access with optional chaining
const value = items[0]?.json?.user?.email || 'default@email.com';

// ✅ CORRECT - check existence first
const value = items[0] && items[0].json && items[0].json.user 
  ? items[0].json.user.email 
  : 'default@email.com';
\`\`\`

**2. Array Handling**
\`\`\`javascript
// ❌ WRONG - returns single object
return { json: { result: 'data' } };

// ✅ CORRECT - always return array of objects
return [{ json: { result: 'data' } }];

// Process multiple items
return items.map(item => ({
  json: {
    ...item.json,
    processed: true
  }
}));
\`\`\`

**3. Async Operations**
\`\`\`javascript
// ❌ WRONG - missing await
const response = fetch('https://api.example.com');

// ✅ CORRECT - await promise
const response = await fetch('https://api.example.com');
const data = await response.json();
\`\`\`

**4. Variable Scope**
\`\`\`javascript
// Access previous node data
const previousData = $node["Previous Node"].json;

// Access workflow static data
const config = $workflow.staticData;

// Access environment variables (if enabled)
const apiKey = $env.API_KEY;
\`\`\`

**Best Practices:**
- Always validate input data exists before accessing
- Return array format: \`[{ json: {...} }]\`
- Use try-catch for external API calls
- Log errors: \`console.log()\` appears in n8n logs`,
        relatedTopics: ['code node', 'javascript', 'error handling'],
        difficulty: 'intermediate'
    },

    // HOW-TO
    {
        category: 'how-to',
        keywords: ['setup', 'workflow', 'create', 'beginner', 'start'],
        question: 'How do I create my first workflow in n8n?',
        answer: `**Step-by-Step: Your First n8n Workflow**

**1. Create New Workflow**
- Click "+" or "New Workflow" button
- Give it a descriptive name (e.g., "Daily Weather Notification")

**2. Add a Trigger Node (Start Point)**
- Click the "+" button
- Choose a trigger:
  - **Schedule Trigger**: Run on timer (daily, hourly, etc.)
  - **Webhook Trigger**: Start via HTTP request
  - **Manual Trigger**: Run manually for testing

Example: Schedule Trigger for 9 AM daily
\`\`\`
Cron Expression: 0 9 * * *
(minute hour day month weekday)
\`\`\`

**3. Add Action Nodes**
- Click "+" after trigger to add nodes
- Common nodes:
  - **HTTP Request**: Get data from APIs
  - **Set**: Transform/modify data
  - **IF**: Conditional logic
  - **Code**: Custom JavaScript

**4. Configure Each Node**
- Click node to open panel
- Fill in required parameters
- Test with "Execute Node" button

**5. Connect Your Data**
- Use expressions: \`{{ $json["field_name"] }}\`
- Access previous node: \`{{ $node["Node Name"].json }}\`

**6. Test & Activate**
- Click "Execute Workflow" to test
- Check each node's output
- Toggle "Active" switch when ready

**Simple Example: Get Weather & Send Email**
1. Schedule Trigger (daily 9 AM)
2. HTTP Request (OpenWeatherMap API)
3. Set (format weather data)
4. Gmail (send email with forecast)`,
        relatedTopics: ['workflow creation', 'triggers', 'nodes'],
        difficulty: 'beginner'
    },

    {
        category: 'how-to',
        keywords: ['loop', 'iterate', 'array', 'multiple items', 'batch'],
        question: 'How do I loop over multiple items/arrays in n8n?',
        answer: `**Processing Multiple Items in n8n**

**Method 1: Automatic Item Processing (Recommended)**
n8n processes arrays automatically - each item runs through nodes:

\`\`\`javascript
// Code node - automatically runs for each item
return [{
  json: {
    ...item.json,
    processed: true
  }
}];
\`\`\`

**Method 2: Split In Batches Node**
For large datasets, process in chunks:

Configuration:
- **Batch Size**: 10 (process 10 items at a time)
- **Options**: Reset after all processed

Use case: API rate limiting, memory management

**Method 3: Loop Node (Function Item)**
For complex iteration logic:

\`\`\`javascript
// Function Item code
const items = $input.all();

return items.map((item, index) => ({
  json: {
    ...item.json,
    index: index,
    total: items.length
  }
}));
\`\`\`

**Method 4: Manual Loop with Code Node**
\`\`\`javascript
const results = [];
const data = $input.all();

for (const item of data) {
  // Process each item
  const processed = {
    originalId: item.json.id,
    transformedValue: item.json.value * 2
  };
  results.push({ json: processed });
}

return results;
\`\`\`

**Common Pattern: Loop with API Calls**
1. **Trigger** → receives array of IDs
2. **Split In Batches** → process 5 at a time
3. **Code** → prepare API request
4. **HTTP Request** → call API for each
5. **Wait** → add delay between batches (rate limiting)
6. **Set** → aggregate results

**Best Practices:**
- Use Split In Batches for 100+ items
- Add Wait node to respect rate limits
- Use execution data pinning to test with sample data
- Monitor memory usage for very large datasets`,
        relatedTopics: ['loops', 'iteration', 'split in batches'],
        difficulty: 'intermediate'
    },

    // NODES
    {
        category: 'nodes',
        keywords: ['http request', 'api', 'rest', 'get', 'post'],
        question: 'How to use the HTTP Request node for API calls?',
        answer: `**Complete Guide: HTTP Request Node**

**Basic Configuration:**
\`\`\`
Method: GET/POST/PUT/DELETE/PATCH
URL: https://api.example.com/endpoint
Authentication: None/Basic/OAuth2/Header/Custom
\`\`\`

**GET Request Example:**
\`\`\`json
{
  "method": "GET",
  "url": "https://api.github.com/users/{{$json["username"]}}",
  "headers": {
    "User-Agent": "n8n-workflow"
  }
}
\`\`\`

**POST Request with Body:**
\`\`\`json
{
  "method": "POST",
  "url": "https://api.example.com/create",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{$credentials.apiKey}}"
  },
  "body": {
    "name": "{{$json["name"]}}",
    "email": "{{$json["email"]}}",
    "timestamp": "{{$now}}"
  }
}
\`\`\`

**Authentication Types:**

1. **Bearer Token**
\`\`\`
Authentication: Header Auth
Name: Authorization
Value: Bearer YOUR_TOKEN
\`\`\`

2. **API Key in Query**
\`\`\`
URL: https://api.example.com/data?api_key={{$credentials.apiKey}}
\`\`\`

3. **Custom Headers**
\`\`\`
Headers:
  X-API-Key: YOUR_KEY
  X-Custom-Header: value
\`\`\`

**Advanced Options:**
- **Query Parameters**: Add key-value pairs
- **Response Format**: JSON/String/Binary
- **Timeout**: Set custom timeout (default 300s)
- **Redirect**: Follow/Ignore redirects
- **SSL**: Ignore SSL issues (not recommended for production)

**Error Handling:**
\`\`\`javascript
// Use IF node to check HTTP status
{{ $json["statusCode"] }} === 200
\`\`\`

**Pro Tips:**
1. Enable "Response" in settings to see full response
2. Use "{{ $json }}" to reference data from previous nodes
3. Test in Postman first, then replicate in n8n
4. For pagination, use Loop nodes or Split In Batches`,
        relatedTopics: ['HTTP requests', 'API integration', 'authentication'],
        difficulty: 'intermediate'
    },

    // BEST PRACTICES
    {
        category: 'best-practices',
        keywords: ['error handling', 'errors', 'try catch', 'workflow'],
        question: 'What are best practices for error handling in workflows?',
        answer: `**Comprehensive Error Handling in n8n**

**1. Error Trigger Node**
Catches errors from ANY workflow:
\`\`\`
Create a separate "Error Handler" workflow:
- Error Trigger node
- Set node (format error info)
- Notification (email/Slack/Discord)
\`\`\`

**2. Try-Catch Pattern with IF Node**
\`\`\`javascript
// Code node - wrap in try-catch
try {
  const result = await externalAPI.call();
  return [{ json: { success: true, data: result } }];
} catch (error) {
  return [{ 
    json: { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    } 
  }];
}

// Follow with IF node
{{ $json["success"] }} === true
// True path: continue workflow
// False path: error handling
\`\`\`

**3. Continue On Fail**
In node settings → "Continue On Fail":
- Workflow doesn't stop on error
- Error data available in output
- Use IF node to check for errors

**4. Retry Logic**
In HTTP Request node settings:
\`\`\`
Retry On Fail: true
 Max Tries: 3
Retry Wait Time: 1000ms (exponential backoff)
\`\`\`

**5. Error Workflow Template**
\`\`\`
Error Trigger
  ↓
Set (Extract error details)
  ↓
IF (Check error type)
  ↓ Critical
  ├→ Slack/Email Alert
  ↓ Non-critical
  └→ Log to Database
\`\`\`

**6. Logging Best Practices**
\`\`\`javascript
// Code node - structured logging
console.log(JSON.stringify({
  workflow: $workflow.name,
  execution: $execution.id,
  error: error.message,
  data: $json,
  timestamp: new Date().toISOString()
}));
\`\`\`

**7. Graceful Degradation**
\`\`\`
HTTP Request (external API)
  ↓ On Fail
IF (Check response)
  ↓ Failed
  └→ Use cached/default data instead
\`\`\`

**Production Checklist:**
✅ Error Trigger workflow for critical alerts
✅ Continue On Fail for non-critical nodes
✅ Retry logic on external API calls
✅ Logging for debugging
✅ Fallback data for external dependencies
✅ Monitoring and alerting setup`,
        relatedTopics: ['error handling', 'production', 'reliability'],
        difficulty: 'advanced'
    },

    {
        category: 'security',
        keywords: ['credentials', 'api key', 'security', 'password', 'token'],
        question: 'How should I manage credentials and API keys securely?',
        answer: `**Secure Credential Management in n8n**

**1. Use n8n Credentials (NEVER Hardcode)**
\`\`\`
❌ WRONG:
const apiKey = "sk_live_xxxxxxxxxxxx";

✅ CORRECT:
// Create credential in n8n UI
// Access in nodes via credential selector
const apiKey = $credentials.apiKey;
\`\`\`

**2. Create Credential:**
- Settings → Credentials → "Create New"
- Choose credential type
- Fill in sensitive data
- Save (encrypted in n8n database)

**3. Environment Variables (Advanced)**
In n8n configuration:
\`\`\`bash
# .env file
API_KEY=your-secret-key
DATABASE_PASSWORD=secure-password
\`\`\`

Access in Code node (if enabled):
\`\`\`javascript
const apiKey = $env.API_KEY;
\`\`\`

**4. Credential Types:**
- **API Key**: Single key/token
- **OAuth2**: Auto token refresh
- **Header Auth**: Custom header credentials
- **Basic Auth**: Username/password
- **JWT**: JSON Web Tokens

**5. Webhook Security:**
\`\`\`
Webhook node settings:
- Authentication: Header Auth
- Header Name: X-Webhook-Secret
- Header Value: {{ $credentials.webhookSecret }}
\`\`\`

Verify in Code node:
\`\`\`javascript
const receivedSecret = $request.headers['x-webhook-secret'];
const expectedSecret = $credentials.webhookSecret;

if (receivedSecret !== expectedSecret) {
  throw new Error('Unauthorized webhook request');
}
\`\`\`

**6. Rotate Credentials Regularly:**
- Update in n8n credentials panel
- All workflows using that credential auto-update
- No code changes needed

**7. Access Control:**
- Limit workflow access to authorized users
- Use n8n's user/team permissions
- Separate credentials for dev/staging/production

**Best Practices:**
✅ Use n8n credential system (encrypted)
✅ Different credentials per environment
✅ Rotate API keys quarterly
✅ Minimum privilege principle
✅ Never log credentials
✅ Use OAuth2 when available (auto-refresh)
✅ Webhook signature verification
✅ HTTPS only for webhooks

**Never:**
❌ Hardcode secrets in workflows
❌ Share credentials via chat/email
❌ Commit credentials to git
❌ Use production keys in testing
❌ Log sensitive data`,
        relatedTopics: ['security', 'credentials', 'API keys'],
        difficulty: 'intermediate'
    },

    {
        category: 'performance',
        keywords: ['slow', 'optimize', 'performance', 'speed', 'timeout'],
        question: 'How do I optimize workflow performance and speed?',
        answer: `**Workflow Performance Optimization**

**1. Reduce Data Size**
\`\`\`javascript
// ❌ BAD - passing entire objects
return [{ json: $node["HTTP Request"].json }];

// ✅ GOOD - only pass needed fields
return [{
  json: {
    id: $json.id,
    name: $json.name
    // exclude large/unused fields
  }
}];
\`\`\`

**2. Use Split In Batches**
For 100+ items:
\`\`\`
Split In Batches node:
- Batch Size: 50
- Process in chunks to avoid memory issues
\`\`\`

**3. Parallel Execution**
Use merge node for parallel processing:
\`\`\`
Trigger
  ├→ Branch 1 (API Call A)
  └→ Branch 2 (API Call B)
    ↓
Merge (wait for both)
\`\`\`

**4. Optimize HTTP Requests**
\`\`\`
- Use connection reuse
- Enable response compression (gzip)
- Set appropriate timeouts
- Batch API calls when possible
\`\`\`

**5. Database Query Optimization**
\`\`\`sql
-- ❌ BAD - N+1 query problem
SELECT * FROM users;
-- Then loop and query orders for each user

-- ✅ GOOD - Single JOIN query
SELECT users.*, orders.* 
FROM users 
LEFT JOIN orders ON users.id = orders.user_id;
\`\`\`

**6. Caching Strategy**
\`\`\`javascript
// Code node - check cache first
const cacheKey = `data_${ $json.id }`;
let data = $workflow.staticData[cacheKey];

if (!data || isCacheExpired(data.timestamp)) {
  // Fetch from API
  const response = await fetch(apiUrl);
  data = {
    result: await response.json(),
    timestamp: Date.now()
  };
  $workflow.staticData[cacheKey] = data;
}

return [{ json: data.result }];
\`\`\`

**7. Avoid Unnecessary Transformations**
\`\`\`javascript
// ❌ BAD - multiple transformations
items.map(i => i.json)
  .filter(j => j.active)
  .map(j => ({ ...j, processed: true }));

// ✅ GOOD - single pass
items
  .filter(i => i.json.active)
  .map(i => ({
    json: { ...i.json, processed: true }
  }));
\`\`\`

**8. Execution Settings**
\`\`\`
Workflow Settings:
- Execution Timeout: Set realistic limit
- Save Data: Only on errors (for production)
- Max Retries: 2-3 for critical workflows
\`\`\`

**9. Monitor & Profile**
\`\`\`javascript
// Add timing logs
const startTime = Date.now();
// ... operation ...
console.log(`Operation took ${ Date.now() - startTime }ms`);
\`\`\`

**Performance Checklist:**
✅ Process data in batches (50-100 items)
✅ Use parallel execution for independent tasks
✅ Cache frequently accessed data
✅ Minimize data passed between nodes
✅ Optimize database queries (indexes, joins)
✅ Set appropriate timeouts
✅ Use webhook responses for long workflows
✅ Monitor execution times regularly

**Benchmarks:**
- Simple workflow: <1s
- API integration: 1-5s
- Data processing (100 items): 5-15s
- Complex multi-step: 15-60s`,
    relatedTopics: ['performance', 'optimization', 'speed'],
    difficulty: 'advanced'
    }
];

/**
 * Get training data by category
 */
export function getTrainingDataByCategory(category: TrainingItem['category']): TrainingItem[] {
    return TRAINING_DATA.filter(item => item.category === category);
}

/**
 * Search training data by keywords
 */
export function searchTrainingData(query: string): TrainingItem[] {
    const lowerQuery = query.toLowerCase();

    return TRAINING_DATA.filter(item => {
        // Check question
        if (item.question.toLowerCase().includes(lowerQuery)) return true;

        // Check keywords
        if (item.keywords.some(k => lowerQuery.includes(k.toLowerCase()))) return true;

        // Check answer
        if (item.answer.toLowerCase().includes(lowerQuery)) return true;

        return false;
    });
}

/**
 * Get relevant context for query
 */
export function getRelevantContext(query: string, maxItems: number = 3): string {
    const relevant = searchTrainingData(query).slice(0, maxItems);

    if (relevant.length === 0) return '';

    return '\n\n**Relevant Information:**\n' + relevant.map(item =>
        `- ${item.question}\n  ${item.answer.substring(0, 200)}...`
    ).join('\n\n');
}
