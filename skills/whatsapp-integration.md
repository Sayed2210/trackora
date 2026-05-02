# Skill: WhatsApp Integration Engineer

## Description
Expert in integrating WhatsApp Business API and SMS services (primarily Twilio) for logistics notifications, customer communication, and two-way chat in the MENA region.

## When to Use
- Setting up WhatsApp notification templates
- Implementing customer communication flows
- Handling inbound WhatsApp messages
- Configuring fallback SMS delivery
- Managing template approval workflows

## Provider Strategy

### Primary: Twilio
- **Best for:** MVP, fast setup, reliable MENA coverage
- **Setup time:** 3-5 days
- **Features:** WhatsApp + SMS fallback in single API
- **Cost:** $0.005-0.008 per session message

### Alternative: Meta Business API Direct
- **Best for:** Scale, full control
- **Setup time:** 2-3 weeks
- **Features:** Rich media, interactive messages
- **Cost:** $0.005 per message

### Alternative: 360dialog
- **Best for:** Fast template approval
- **Setup time:** 1 week
- **Features:** Good MENA coverage, fast approval
- **Cost:** $0.003 per message + monthly fee

## Implementation Patterns

### Template-Based Messages (Required for Initiation)
```typescript
@Injectable()
export class WhatsAppService {
  constructor(private readonly twilioClient: Twilio) {}

  async sendTemplateMessage(
    to: string,
    templateName: string,
    variables: Record<string, string>
  ): Promise<void> {
    const template = await this.getTemplate(templateName);
    
    await this.twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
      body: this.fillTemplate(template.content, variables),
    });
  }

  private fillTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] || match);
  }
}
```

### Session Messages (24h Window)
```typescript
async sendSessionMessage(to: string, message: string): Promise<void> {
  // Can send free-form text within 24h of last customer message
  await this.twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${to}`,
    body: message,
  });
}
```

### Fallback to SMS
```typescript
async sendWithFallback(to: string, message: string): Promise<void> {
  try {
    await this.sendWhatsApp(to, message);
  } catch (error) {
    this.logger.warn(`WhatsApp failed, falling back to SMS: ${error.message}`);
    await this.sendSMS(to, message);
  }
}
```

## Template Catalog

### Delivery Confirmation (Arabic)
```
Name: delivery_confirmed_ar
Content: مرحباً {{1}}، تم استلام طلبك رقم {{2}} من {{3}}. سيتم التوصيل قريباً.
Variables: customerName, trackingNumber, merchantName
```

### Out for Delivery (Arabic)
```
Name: out_for_delivery_ar
Content: مرحباً {{1}}، طلبك {{2}} في الطريق إليك اليوم!
Variables: customerName, trackingNumber
```

### Delivery Complete (Arabic)
```
Name: delivered_ar
Content: تم تسليم طلبك بنجاح! شكراً لتسوقك مع {{1}}.
Variables: merchantName
```

### COD Collected (Merchant)
```
Name: cod_collected_merchant_ar
Content: تم تحصيل {{1}} جنيه لطلب {{2}}. رصيدك الجديد: {{3}} جنيه.
Variables: amount, trackingNumber, balance
```

## Inbound Message Handling

### Webhook Endpoint
```typescript
@Post('webhooks/twilio/whatsapp')
async handleIncomingMessage(@Body() payload: TwilioWebhookPayload): Promise<void> {
  // Validate Twilio signature
  const isValid = this.validateTwilioSignature(payload);
  if (!isValid) throw new UnauthorizedException();

  const { From, Body, MessageSid } = payload;
  const phone = From.replace('whatsapp:', '');

  // Detect intent
  const intent = this.detectIntent(Body);

  switch (intent) {
    case 'TRACK_SHIPMENT':
      await this.handleTrackRequest(phone);
      break;
    case 'POSTPONE':
      await this.handlePostponeRequest(phone, payload);
      break;
    case 'STOP':
      await this.handleOptOut(phone);
      break;
    default:
      await this.sendHelpMessage(phone);
  }
}
```

### Intent Detection
```typescript
function detectIntent(message: string): Intent {
  const normalized = message.toLowerCase().trim();
  
  if (normalized.match(/وين|فين|where|status|موقع|رقم/)) {
    return 'TRACK_SHIPMENT';
  }
  if (normalized.match(/تأجيل|postpone|later|tomorrow|بكرة/)) {
    return 'POSTPONE';
  }
  if (normalized.match(/stop|إلغاء|unsubscribe|توقف/)) {
    return 'STOP';
  }
  if (normalized.match(/شكرا|thanks|thank you/)) {
    return 'THANKS';
  }
  return 'UNKNOWN';
}
```

## Queue-Based Sending

```typescript
@Processor('notifications')
export class WhatsAppProcessor {
  @Process('send-whatsapp')
  async handleSend(job: Job<WhatsAppJobData>) {
    const { to, templateName, variables, shipmentId } = job.data;
    
    try {
      await this.whatsAppService.sendTemplateMessage(to, templateName, variables);
      
      await this.prisma.notificationLog.create({
        data: {
          shipmentId,
          channel: 'WHATSAPP',
          status: 'DELIVERED',
          sentAt: new Date(),
        }
      });
    } catch (error) {
      // Retry with exponential backoff
      if (job.attemptsMade < 3) {
        throw error; // BullMQ will retry
      }
      
      // Fallback to SMS
      await this.smsService.send(to, this.formatSMSMessage(templateName, variables));
    }
  }
}
```

## Rate Limiting & Compliance

- **Message frequency:** Max 1 template message per hour per customer
- **Quiet hours:** No messages between 10 PM and 8 AM Cairo time
- **Opt-out:** Respect STOP requests immediately
- **Template approval:** All templates must be approved by Meta before use
- **Content rules:** No promotional content in utility templates

## Testing

```typescript
// Mock Twilio for tests
const mockTwilioClient = {
  messages: {
    create: jest.fn().mockResolvedValue({ sid: 'mock-sid', status: 'queued' })
  }
};

// Test template rendering
describe('WhatsAppService', () => {
  it('should fill template variables correctly', () => {
    const template = 'Hello {{1}}, your order {{2}} is ready';
    const result = service.fillTemplate(template, { '1': 'Ahmed', '2': 'TRK-123' });
    expect(result).toBe('Hello Ahmed, your order TRK-123 is ready');
  });
});
```

## Example Usage
User: "I need to send a WhatsApp notification when a shipment is out for delivery"
→ Use this skill to create the template, implement the queue job, and handle the event trigger.
