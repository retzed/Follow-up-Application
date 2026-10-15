import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile('index.html', 'utf8');
const seedStart = html.indexOf('function seedData(){');
const seedEnd = html.indexOf('\nlet data;', seedStart);
assert.ok(seedStart >= 0 && seedEnd > seedStart, 'The built-in demo seed function must exist.');
const seedSource = html.slice(seedStart, seedEnd);

let sequence = 0;
const context = {
  ago(days = 0, minutes = 0) {
    return new Date(Date.now() - days * 86400000 - minutes * 60000).toISOString();
  },
  dateKey(value) {
    return String(value || '').slice(0, 10);
  },
  uid(prefix) {
    sequence += 1;
    return String(prefix) + '_seed_test_' + sequence;
  }
};
vm.runInNewContext(seedSource + '\nthis.seedData = seedData;', context);
const data = context.seedData();
const allItems = [...data.parents, ...data.children];
const byId = new Map(allItems.map(item => [String(item.id), item]));
const roots = data.parents.filter(item => item.type === 'project' || item.type === 'job');
const projects = roots.filter(item => item.type === 'project');
const jobs = roots.filter(item => item.type === 'job');
const tasks = data.children.filter(item => item.type === 'task');
const followups = data.children.filter(item => item.type === 'followup');
const eventsByItem = new Map();
const eventIds = new Set();

assert.equal(data.users.length, 6, 'The demo retains all six teammate profiles.');
assert.equal(projects.length, 16, 'The AWS runbook contains sixteen Project chapters.');
assert.equal(jobs.length, 1, 'The optional SAM route is a separate Job.');
assert.equal(tasks.length, 80, 'Each Project chapter contains five documentation Tasks.');
assert.equal(followups.length, 364, 'The dataset includes task steps, project checkpoints and optional-job steps.');
assert.equal(allItems.length, 461, 'The full built-in AWS documentation workspace has 461 work items.');
assert.equal(data.activity.length, 1844, 'Each work item has four seeded Activity events.');
assert.equal(new Set(allItems.map(item => item.id)).size, allItems.length, 'Every work item ID is unique.');

for (const item of allItems) {
  assert.ok(['project', 'job', 'task', 'followup'].includes(item.type), 'Item type is valid: ' + item.id);
  assert.ok(item.name && item.name.trim(), 'Every seeded work item needs a name: ' + item.id);
  assert.ok(item.description && item.description.trim(), 'Every work item contains documentation: ' + item.id);
  assert.ok(data.users.some(user => user.id === item.ownerId), 'Every assignee resolves to a built-in user: ' + item.id);
  assert.ok(Number.isFinite(Date.parse(item.createdAt)), 'Every item has a valid createdAt: ' + item.id);
  assert.ok(Number.isFinite(Date.parse(item.updatedAt)), 'Every item has a valid updatedAt: ' + item.id);
  assert.ok(Date.parse(item.createdAt) <= Date.parse(item.updatedAt), 'Item creation does not follow its update: ' + item.id);
  if (item.type === 'task') {
    assert.equal(byId.get(String(item.parentId))?.type, 'project', 'Tasks can only be children of Projects.');
  } else if (item.type === 'followup') {
    const parent = byId.get(String(item.parentId));
    assert.ok(parent && ['project', 'job', 'task'].includes(parent.type), 'Follow-ups must have a supported parent.');
  } else {
    assert.equal(item.parentId, undefined, 'Projects and Jobs are top-level items.');
  }
}

for (const project of projects) {
  const direct = followups.filter(item => item.parentId === project.id);
  const projectTasks = tasks.filter(item => item.parentId === project.id);
  assert.equal(projectTasks.length, 5, project.name + ' has five documentation Tasks.');
  assert.equal(direct.length, 2, project.name + ' has two chapter-level checkpoints.');
  for (const task of projectTasks) {
    assert.equal(followups.filter(item => item.parentId === task.id).length, 4, task.name + ' has four actionable steps.');
  }
}
assert.equal(tasks.filter(item => item.parentId === jobs[0].id).length, 0, 'The Job contains no Tasks.');
assert.equal(followups.filter(item => item.parentId === jobs[0].id).length, 12, 'The optional SAM Job has twelve direct Follow-ups.');

for (const event of data.activity) {
  assert.ok(event.id && !eventIds.has(event.id), 'Activity event IDs must be non-empty and unique.');
  eventIds.add(event.id);
  assert.ok(byId.has(String(event.itemId)), 'Activity must refer to a seeded work item.');
  assert.ok(roots.some(root => root.id === event.rootParentId), 'Activity must preserve the top-level root ID.');
  assert.ok(data.users.some(user => user.id === event.userId), 'Every Activity actor must resolve to a teammate.');
  assert.ok(Number.isFinite(Date.parse(event.at)), 'Every Activity event needs a valid timestamp.');
  eventsByItem.set(event.itemId, (eventsByItem.get(event.itemId) || 0) + 1);
}
assert.equal(eventIds.size, data.activity.length, 'Activity event IDs have no duplicates.');
for (const item of allItems) {
  assert.equal(eventsByItem.get(item.id), 4, item.name + ' has a full four-event history.');
}

const requiredTopics = [
  'Cognito', 'DynamoDB', 'ParentIdIndex', 'AssignedToIndex', 'WorkspaceIndex',
  'TeamFollowUp-Activity', 'TeamFollowUp-Users', 'GSI_ArchiveIndex', 'GSI_ArchiveRoot',
  'TEAM_FOLLOW_UP_COGNITO_USER_POOL_ID', 'TEAM_FOLLOW_UP_COGNITO_CLIENT_ID',
  'TEAM_FOLLOW_UP_API_BASE_URL', 'custom:teamUserId', 'API Gateway', 'CORS',
  'CloudWatch', 'TeamFollowUp-Monthly-Cost', 'Retain', 'SAM / CloudFormation'
];
const searchableText = [...roots, ...data.children].map(item => item.name + '\n' + item.description).join('\n');
for (const topic of requiredTopics) {
  assert.ok(searchableText.toLowerCase().includes(topic.toLowerCase()), 'Dataset covers documentation topic: ' + topic);
}

assert.ok(html.includes("const STORAGE_KEY = 'team-follow-up-demo-v5';"), 'The demo workspace storage namespace is versioned for the new seed.');
assert.ok(html.includes("const TABLES_KEY='team-follow-up-builtin-dynamodb-tables-v3';"), 'Existing browser profiles receive fresh built-in work items.');
assert.ok(html.includes("const ACTIVITY_EVENT_PREFIX='team-follow-up-builtin-dynamodb-activity-event-v3:'"), 'Existing browser profiles receive the expanded Activity fixture.');
assert.ok(html.includes('function persistInitialActivityBatch(rawEvents){'), 'Large local Activity fixtures must use the indexed bulk-seed path.');
const batchStart = html.indexOf('function persistInitialActivityBatch(rawEvents){');
const batchEnd = html.indexOf('function readActivityEventsForItems(', batchStart);
assert.ok(batchEnd > batchStart, 'The Activity bulk-seed helper must be correctly delimited.');
assert.ok(!html.slice(batchStart, batchEnd).includes('activityEventIdInUse('), 'Bulk seeding must not rescan the entire event store for each new event.');
const bootstrapStart = html.indexOf('async function bootstrap(fallback,onProgress)');
const bootstrapEnd = html.indexOf('function sameRecordFields(', bootstrapStart);
assert.ok(bootstrapEnd > bootstrapStart, 'The built-in bootstrap function must be present.');
const builtinBootstrap = html.slice(bootstrapStart, bootstrapEnd);
assert.ok(builtinBootstrap.indexOf('await new Promise(resolve=>') < builtinBootstrap.indexOf('writeTables(tableFromSnapshot'), 'Yield before writing the large demo fixture so loading placeholders can paint.');

console.log('Demo seed-data tests passed: 461 work items, 1,844 Activity events, valid hierarchy, complete event coverage and current AWS documentation topics.');
