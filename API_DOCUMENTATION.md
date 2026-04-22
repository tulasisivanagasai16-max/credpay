# CredPay API Documentation

## Base URL
```
Production: https://api.credpay.com/api/v1
Staging:    https://staging-api.credpay.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

### Authorization Header
All authenticated endpoints require Bearer token:
```
Authorization: Bearer <access_token>
```

### Token Types

#### Access Token (JWT)
- **Expiry**: 15 minutes
- **Algorithm**: RS256 (RSA asymmetric)
- **Payload**:
  ```json
  {
    "sub": "user_uuid",
    "email": "user@example.com",
    "role": "user|admin",
    "iat": 1234567890,
    "exp": 1234568790
  }
  ```

#### Refresh Token
- **Expiry**: 30 days
- **Storage**: HTTP-only, Secure, SameSite=Strict cookie only
- **Endpoint**: `POST /auth/refresh`

---

## API Endpoints

### Authentication APIs

#### 1. User Registration
```
POST /auth/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "phoneNumber": "+919876543210" (optional)
}

Response (201):
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "accessToken": "eyJ...",
    "refreshToken": "automatically stored in cookie"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (400):
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Email already registered",
    "details": {}
  }
}
```

#### 2. User Login
```
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "deviceId": "device-uuid" (optional),
  "deviceName": "iPhone 15 Pro" (optional)
}

Response (200):
{
  "success": true,
  "data": {
    "userId": "uuid",
    "accessToken": "eyJ...",
    "user": {
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "isEmailVerified": true,
      "isPhoneVerified": false
    }
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

#### 3. Refresh Token
```
POST /auth/refresh
Cookie: refreshToken=...

Response (200):
{
  "success": true,
  "data": {
    "accessToken": "eyJ..."
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (401):
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token expired or invalid"
  }
}
```

#### 4. Logout
```
POST /auth/logout
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": null,
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

### Wallet & Balance APIs

#### 5. Get Wallet Balance
```
GET /wallet/balance
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "walletId": "uuid",
    "userId": "uuid",
    "balancePaise": "1000000",  // ₹10,000 in paise
    "balanceFormatted": "₹10,000.00",
    "currency": "INR",
    "status": "ACTIVE",
    "totalTopupPaise": "5000000",
    "totalPayoutPaise": "3000000",
    "totalFeePaise": "100000",
    "lastUpdatedAt": "2026-04-22T09:55:30Z"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

### Payment APIs (Credit Card Add Money)

#### 6. Create Payment Intent
```
POST /payments/create-intent
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "amountPaise": "100000",  // ₹1,000
  "cardNumber": "4532xxxxxxxxxxxx",
  "cardLast4": "4532",
  "cardholderName": "John Doe",
  "cardExpiry": "12/28",
  "cardCvv": "123"
}

Response (201):
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_uuid",
    "orderId": "order_razorpay_id",
    "amountPaise": "100000",
    "feePaise": "2500",
    "netPaise": "97500",  // Amount actually credited to wallet
    "status": "REQUIRES_CONFIRMATION",
    "gateway": "razorpay",
    "razorpayPublicKey": "rzp_test_xxxxx",
    "idemPotencyKey": "uuid",
    "expiresAt": "2026-04-22T10:15:00Z"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (400):
{
  "success": false,
  "error": {
    "code": "KYC_REQUIRED",
    "message": "Complete KYC verification before adding money",
    "details": {
      "minAmount": "100",
      "currentLimit": "0"
    }
  }
}
```

#### 7. Confirm Payment
```
POST /payments/confirm
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "paymentIntentId": "pi_uuid",
  "razorpayPaymentId": "pay_xxxxx",
  "razorpaySignature": "signature_from_checkout_js"
}

Response (200):
{
  "success": true,
  "data": {
    "transactionId": "txn_uuid",
    "status": "SUCCESS",
    "amountPaise": "100000",
    "feePaise": "2500",
    "walletBalancePaise": "1000000",
    "message": "Money added successfully. ₹10,000 now available in your wallet."
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (402):
{
  "success": false,
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "Card declined by issuer",
    "details": {
      "gatewayCode": "CARD_DECLINED",
      "retryable": true
    }
  }
}
```

#### 8. Get Payment Status
```
GET /payments/:paymentIntentId
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_uuid",
    "status": "SUCCESS|PENDING|FAILED",
    "amountPaise": "100000",
    "transactionId": "txn_uuid",
    "createdAt": "2026-04-22T09:50:00Z",
    "confirmedAt": "2026-04-22T10:00:00Z"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

### Payout APIs (UPI/Bank Transfer)

#### 9. Get Payees
```
GET /payouts/payees
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "payees": [
      {
        "payeeId": "uuid",
        "label": "My UPI ID",
        "type": "UPI",
        "identifier": "user@upi",
        "createdAt": "2026-04-22T08:00:00Z"
      },
      {
        "payeeId": "uuid",
        "label": "Bank Account",
        "type": "BANK",
        "identifier": "123456789012",
        "ifsc": "HDFC0001234",
        "createdAt": "2026-04-22T08:30:00Z"
      }
    ]
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

#### 10. Add Payee
```
POST /payouts/payees
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "label": "My UPI ID",
  "type": "UPI",  // UPI or BANK
  "identifier": "user@upi",  // UPI ID or account number
  "ifsc": "HDFC0001234" (required if type=BANK)
}

Response (201):
{
  "success": true,
  "data": {
    "payeeId": "uuid",
    "label": "My UPI ID",
    "type": "UPI",
    "identifier": "user@upi",
    "createdAt": "2026-04-22T10:00:00Z"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (400):
{
  "success": false,
  "error": {
    "code": "INVALID_UPI",
    "message": "UPI ID format is invalid"
  }
}
```

#### 11. Create Payout
```
POST /payouts/create
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "payeeId": "uuid",
  "amountPaise": "500000",  // ₹5,000
  "note": "Payment for rent"
}

Response (201):
{
  "success": true,
  "data": {
    "payoutId": "pout_uuid",
    "transactionId": "txn_uuid",
    "amountPaise": "500000",
    "feePaise": "5000",
    "totalDebitPaise": "505000",  // Amount debited from wallet
    "status": "PENDING",
    "payeeDetails": {
      "label": "My UPI ID",
      "type": "UPI",
      "identifier": "user@upi"
    },
    "estimatedCompletionTime": "2026-04-22T10:05:00Z",
    "note": "Payment for rent"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (402):
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet balance insufficient for this payout",
    "details": {
      "requiredAmount": "505000",
      "availableBalance": "100000"
    }
  }
}
```

#### 12. Get Payout Status
```
GET /payouts/:payoutId
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "payoutId": "pout_uuid",
    "status": "PENDING|SUCCESS|FAILED",
    "amountPaise": "500000",
    "feePaise": "5000",
    "payeeDetails": {
      "label": "My UPI ID",
      "type": "UPI",
      "identifier": "user@upi"
    },
    "gatewayRef": "payout_cashfree_id",
    "createdAt": "2026-04-22T10:00:00Z",
    "completedAt": "2026-04-22T10:03:00Z",
    "failureReason": null
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

### Transaction History APIs

#### 13. Get Transaction History
```
GET /transactions?limit=50&offset=0&type=PAYMENT,PAYOUT&status=SUCCESS
Authorization: Bearer <accessToken>

Query Parameters:
- limit: number (default: 50, max: 100)
- offset: number (default: 0)
- type: string (PAYMENT|PAYOUT|TRANSFER|REVERSAL)
- status: string (PENDING|SUCCESS|FAILED)
- startDate: ISO date string
- endDate: ISO date string

Response (200):
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "txn_uuid",
        "type": "PAYMENT",
        "status": "SUCCESS",
        "amountPaise": "100000",
        "feePaise": "2500",
        "balanceAfterPaise": "1000000",
        "description": "Card load via Razorpay",
        "createdAt": "2026-04-22T10:00:00Z"
      },
      {
        "transactionId": "txn_uuid2",
        "type": "PAYOUT",
        "status": "SUCCESS",
        "amountPaise": "500000",
        "feePaise": "5000",
        "balanceAfterPaise": "500000",
        "description": "UPI transfer to user@upi",
        "createdAt": "2026-04-22T09:50:00Z"
      }
    ],
    "total": 2,
    "limit": 50,
    "offset": 0
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

### KYC APIs

#### 14. Get KYC Status
```
GET /kyc/status
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "kycId": "uuid",
    "status": "PENDING|VERIFIED|REJECTED",
    "fullName": "John Doe",
    "panMasked": "XXXXXX1234D",
    "addressMasked": "Bangalore, Karnataka",
    "submittedAt": "2026-04-20T14:30:00Z",
    "reviewedAt": "2026-04-21T08:00:00Z",
    "dailyLimit": "5000000",  // ₹50,000 for verified KYC
    "dailySpentToday": "1000000"  // ₹10,000 already spent
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

#### 15. Submit KYC
```
POST /kyc/submit
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

Request:
- fullName: John Doe
- panNumber: AIDPD1234D
- addressProof: [file: pdf, jpg, png]
- panProof: [file: pdf, jpg, png]

Response (202):
{
  "success": true,
  "data": {
    "kycId": "uuid",
    "status": "PENDING",
    "message": "KYC submitted for verification. You'll receive an update within 24 hours."
  },
  "timestamp": "2026-04-22T10:00:00Z"
}

Error (409):
{
  "success": false,
  "error": {
    "code": "KYC_ALREADY_SUBMITTED",
    "message": "KYC already in verification. Status: PENDING"
  }
}
```

---

### Admin APIs

#### 16. Update User Status (Admin only)
```
PATCH /admin/users/:userId
Authorization: Bearer <adminToken>
Content-Type: application/json

Request:
{
  "isSuspended": true,
  "suspensionReason": "Suspected fraud activity"
}

Response (200):
{
  "success": true,
  "data": {
    "userId": "uuid",
    "isSuspended": true,
    "suspensionReason": "Suspected fraud activity"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

#### 17. Review KYC (Admin only)
```
PATCH /admin/kyc/:kycId
Authorization: Bearer <adminToken>
Content-Type: application/json

Request:
{
  "status": "VERIFIED|REJECTED",
  "rejectionReason": "Optional reason if rejected"
}

Response (200):
{
  "success": true,
  "data": {
    "kycId": "uuid",
    "userId": "uuid",
    "status": "VERIFIED",
    "reviewedAt": "2026-04-22T10:00:00Z"
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "fieldName": "specific error details"
    }
  },
  "timestamp": "2026-04-22T10:00:00Z"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async processing) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (can't process) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_REQUEST | 400 | Invalid request parameters |
| VALIDATION_ERROR | 400 | Field validation failed |
| EMAIL_ALREADY_EXISTS | 409 | Email registered |
| INVALID_CREDENTIALS | 401 | Wrong password |
| TOKEN_EXPIRED | 401 | Access token expired |
| KYC_REQUIRED | 402 | User must complete KYC |
| KYC_VERIFIED_REQUIRED | 402 | User must verify KYC |
| INSUFFICIENT_BALANCE | 402 | Not enough wallet balance |
| DAILY_LIMIT_EXCEEDED | 402 | Daily transaction limit reached |
| PAYOUT_BLOCKED | 402 | Payout blocked by risk engine |
| PAYMENT_FAILED | 402 | Payment gateway declined |
| PAYEE_NOT_FOUND | 404 | Payee doesn't exist |
| PAYOUT_NOT_FOUND | 404 | Payout not found |
| USER_SUSPENDED | 403 | Account suspended |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |

---

## Rate Limiting

### Rate Limit Headers

All responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1234567890
```

### Rate Limit Tiers

| Endpoint | Limit | Window |
|----------|-------|--------|
| General | 100 | 1 minute |
| Payment creation | 10 | 1 minute |
| Payout creation | 5 | 1 minute |
| Login | 5 | 5 minutes |
| Register | 3 | 1 hour |

---

## Webhooks

### Payment Gateway Webhook
```
POST /webhooks/payments/razorpay
Content-Type: application/json
X-Razorpay-Signature: signature

Body:
{
  "event": "payment.authorized",
  "created_at": 1234567890,
  "payload": {
    "payment": {
      "entity": "payment",
      "id": "pay_xxxxx",
      "order_id": "order_xxxxx",
      "amount": 100000,
      "status": "authorized|captured",
      "method": "card",
      "card": {
        "last4": "4532",
        "name": "John Doe"
      }
    }
  }
}
```

### Payout Webhook
```
POST /webhooks/payouts/cashfree
Content-Type: application/json

Body:
{
  "event": "transfer.completed",
  "data": {
    "transfer_id": "pout_xxxxx",
    "status": "SUCCESS|FAILED",
    "amount": 500000,
    "remarks": "Transfer successful"
  }
}
```

---

## Pagination

All list endpoints support pagination:

```
GET /transactions?limit=50&offset=0

Response:
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 250,
      "hasMore": true
    }
  }
}
```

---

## Idempotency

For financial operations, use idempotency keys to prevent duplicate processing:

```
POST /payments/create-intent
Idempotency-Key: unique-key-uuid

If request is retried with same Idempotency-Key, 
the original response is returned without reprocessing.
```

---

## API Changelog

### v1.0.0 (Current)
- Initial API release
- Payment and payout support
- KYC management
- Wallet balance queries
- Transaction history

## Support

- **Email**: support@credpay.com
- **Status**: https://status.credpay.com
- **Docs**: https://docs.credpay.com
