# Phase 6: Offline Notifications - Testing Guide

## 🧪 Manual Testing Steps

### Prerequisites
```bash
# Ensure Redis is running
redis-cli ping  # Should return "PONG"

# Start the backend
cd backend
npm run start:dev
```

---

## Test Scenario 1: Offline User Receives Notification

### Setup
1. User A and User B have an existing conversation
2. User B is offline (no active WebSocket connection)

### Steps
```bash
# Send a message from User A to User B
curl -X POST http://localhost:3001/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_A_TOKEN>" \
  -d '{
    "conversationId": "<CONVERSATION_ID>",
    "content": "Hello from User A!",
    "type": "text"
  }'
```

### Expected Backend Logs
```
📬 Enqueued 1 notification job(s) for message msg_abc123
📬 Processing notification job: msg_abc123:user_b_id
🔔 Notify user user_b_id about new message msg_abc123 in conversation conv_xyz
✉️  [MOCK] Notification sent to user user_b_id
✅ Job msg_abc123:user_b_id completed successfully
```

---

## Test Scenario 2: Online User Does NOT Receive Notification

### Setup
1. User A and User B have an existing conversation
2. User B is online (active WebSocket connection with presence)

### Steps
```bash
# 1. Ensure User B is online (simulate via Redis)
redis-cli SET user:user_b_id:online true EX 60

# 2. Send a message from User A to User B
curl -X POST http://localhost:3001/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_A_TOKEN>" \
  -d '{
    "conversationId": "<CONVERSATION_ID>",
    "content": "Hello from User A!",
    "type": "text"
  }'
```

### Expected Backend Logs
```
📬 Enqueued 1 notification job(s) for message msg_abc123
📬 Processing notification job: msg_abc123:user_b_id
⏭️  User user_b_id is online - skipping notification
✅ Job msg_abc123:user_b_id completed successfully
```

---

## Test Scenario 3: Group Chat (Multiple Recipients)

### Setup
1. Group conversation with 4 members: User A, B, C, D
2. User B is online, User C and D are offline

### Steps
```bash
# Send a message from User A to group
curl -X POST http://localhost:3001/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_A_TOKEN>" \
  -d '{
    "conversationId": "<GROUP_CONVERSATION_ID>",
    "content": "Hello everyone!",
    "type": "text"
  }'
```

### Expected Backend Logs
```
📬 Enqueued 3 notification job(s) for message msg_abc123
📬 Processing notification job: msg_abc123:user_b_id
⏭️  User user_b_id is online - skipping notification
✅ Job msg_abc123:user_b_id completed successfully

📬 Processing notification job: msg_abc123:user_c_id
🔔 Notify user user_c_id about new message msg_abc123 in conversation group_xyz
✉️  [MOCK] Notification sent to user user_c_id
✅ Job msg_abc123:user_c_id completed successfully

📬 Processing notification job: msg_abc123:user_d_id
🔔 Notify user user_d_id about new message msg_abc123 in conversation group_xyz
✉️  [MOCK] Notification sent to user user_d_id
✅ Job msg_abc123:user_d_id completed successfully
```

---

## Test Scenario 4: Idempotency (Duplicate Job)

### Setup
Test that the same notification job can't be processed twice

### Steps
```bash
# Manually enqueue the same job twice (simulating a retry or duplicate)
# This requires accessing the queue directly from code or BullMQ UI
```

### Expected Behavior
- First enqueue: Job created successfully
- Second enqueue: BullMQ rejects duplicate (same jobId)
- Only one notification is sent

---

## Test Scenario 5: Worker Retry on Failure

### Setup
Simulate a transient failure (e.g., Redis temporarily unavailable)

### Steps
1. Stop Redis temporarily while a job is being processed
2. Worker fails to check presence
3. Job is retried with exponential backoff

### Expected Backend Logs
```
📬 Processing notification job: msg_abc123:user_b_id
❌ Job msg_abc123:user_b_id failed: Connection timeout
[1 second delay]
📬 Processing notification job: msg_abc123:user_b_id (attempt 2)
🔔 Notify user user_b_id about new message msg_abc123
✅ Job msg_abc123:user_b_id completed successfully
```

---

## 🔍 Inspecting Redis Queue

### View queued jobs
```bash
# Check if jobs are in the queue
redis-cli KEYS "bull:notifications-queue:*"

# View job data
redis-cli GET "bull:notifications-queue:msg_abc123:user_b_id"
```

### View presence data
```bash
# Check online users
redis-cli KEYS "user:*:online"

# Check specific user
redis-cli GET "user:user_b_id:online"
```

---

## 📊 Performance Verification

### Measure realtime latency (should be unaffected)
```bash
# Send 10 messages and measure response time
for i in {1..10}; do
  time curl -X POST http://localhost:3001/messages \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <USER_A_TOKEN>" \
    -d '{
      "conversationId": "<CONVERSATION_ID>",
      "content": "Test message '$i'",
      "type": "text"
    }'
done
```

### Expected Results
- Average response time: < 100ms
- Response time should NOT increase with offline users
- Queue enqueue happens asynchronously

---

## 🐛 Troubleshooting

### No logs appearing
- Check that backend is running: `npm run start:dev`
- Check that Redis is running: `redis-cli ping`
- Verify environment variables are set correctly

### Jobs not being processed
- Check that the worker is running (should start automatically with the backend)
- Check Redis connection in logs: `✅ BullMQ notification worker started`
- Check for errors in worker logs

### Notifications sent to online users
- Verify Redis presence is set: `redis-cli GET user:<userId>:online`
- Ensure WebSocket connection is established
- Check presence TTL (60 seconds)

---

## 🔗 Next Steps (Future Phases)

1. **Integrate FCM**: Replace mock with Firebase Cloud Messaging
2. **Email notifications**: Add SendGrid/AWS SES for email fallback
3. **Notification preferences**: Allow users to configure notification settings
4. **BullMQ UI**: Add bull-board for visual queue management
5. **Metrics**: Export job metrics to monitoring system
