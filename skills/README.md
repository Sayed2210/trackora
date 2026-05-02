# Trackora Skills System

## Overview

This directory contains specialized skills for the Trackora Logistics & COD Shipment Management SaaS. Each skill encapsulates domain expertise, coding patterns, and best practices for specific areas of the platform.

## Available Skills

| Skill | File | Expertise |
|-------|------|-----------|
| **Backend Architect** | `backend-architect.md` | NestJS architecture, module design, DI patterns |
| **COD Logistics Domain** | `cod-logistics-domain.md` | Shipment lifecycle, state machines, financial reconciliation |
| **Prisma PostgreSQL** | `prisma-postgres.md` | Database design, query optimization, migrations |
| **WhatsApp Integration** | `whatsapp-integration.md` | Twilio/Meta API, templates, two-way chat |
| **Security & Compliance** | `security-compliance.md` | RBAC, PII protection, audit logging |
| **API Designer** | `api-designer.md` | RESTful APIs, OpenAPI, webhooks, pagination |
| **Testing Engineer** | `testing-engineer.md` | Unit, integration, E2E tests, factories |
| **DevOps Engineer** | `devops-engineer.md` | AWS, Docker, CI/CD, monitoring |
| **Dispatch Optimizer** | `dispatch-optimizer.md` | Auto-dispatch algorithms, route optimization |

## How to Use Skills

### 1. Automatic Loading
Skills are automatically applied based on context. When discussing:
- Database queries → Prisma PostgreSQL skill activates
- WhatsApp notifications → WhatsApp Integration skill activates
- State machines → COD Logistics Domain skill activates

### 2. Explicit Invocation
You can request specific expertise:
```
"Using the Backend Architect skill, design a new module for..."
"Apply the Security skill to review this endpoint..."
"From a Dispatch Optimizer perspective, how should we..."
```

### 3. Cross-Skill Collaboration
Complex tasks often require multiple skills:
- **New feature implementation:** Backend Architect + API Designer + COD Logistics Domain
- **Financial workflow:** COD Logistics Domain + Security & Compliance + Testing Engineer
- **Production deployment:** DevOps Engineer + Backend Architect + Security & Compliance

## Skill Components

Each skill includes:
- **Description:** When and why to use this skill
- **Expertise Areas:** Specific domains of knowledge
- **Decision Framework:** How to make choices within this domain
- **Code Patterns:** Common implementations and examples
- **Validation Checklist:** Quality criteria to verify
- **Common Pitfalls:** Mistakes to avoid
- **Example Usage:** How to invoke the skill

## Adding New Skills

To add a new skill:
1. Create a new `.md` file in this directory
2. Follow the template structure from existing skills
3. Update this README
4. Reference the skill in AGENTS.md if core to the project

## Skill Hierarchy

```
Project Context (AGENTS.md)
    ├── Core Skills
    │   ├── Backend Architect
    │   ├── COD Logistics Domain
    │   └── Security & Compliance
    ├── Technical Skills
    │   ├── Prisma PostgreSQL
    │   ├── API Designer
    │   ├── Testing Engineer
    │   └── DevOps Engineer
    └── Domain Skills
        ├── WhatsApp Integration
        └── Dispatch Optimizer
```

## Quick Reference

### For Backend Development
Primary: Backend Architect + Prisma PostgreSQL
Supporting: API Designer, Testing Engineer, Security & Compliance

### For Business Logic
Primary: COD Logistics Domain
Supporting: Backend Architect, Security & Compliance

### For Mobile/PWA
Primary: Backend Architect (for APIs)
Supporting: WhatsApp Integration (for notifications)

### For DevOps
Primary: DevOps Engineer
Supporting: Backend Architect, Security & Compliance

### For Data & Analytics
Primary: Prisma PostgreSQL
Supporting: Backend Architect, COD Logistics Domain

---

*This skills system is designed to make AI assistance more consistent, knowledgeable, and context-aware for the Trackora project.*
