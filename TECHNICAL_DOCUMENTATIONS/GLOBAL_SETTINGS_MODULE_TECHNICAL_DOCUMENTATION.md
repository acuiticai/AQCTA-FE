# Global Settings Module - Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Submodules](#submodules)
4. [API Documentation](#api-documentation)
5. [Data Models](#data-models)
6. [Frontend Structure](#frontend-structure)
7. [Backend Structure](#backend-structure)
8. [Integration Points](#integration-points)
9. [Workflows](#workflows)
10. [Technical Implementation Details](#technical-implementation-details)

---

## Overview

The Global Settings module is a comprehensive system administration and configuration management module that provides centralized control over system-wide settings, user management, role-based access control, business management, activity tracking, and system configuration. It serves as the administrative backbone of the application, enabling system administrators to manage all critical aspects of the platform.

### Key Features
- **User Management**: Complete system user lifecycle management
- **Role-Based Access Control (RBAC)**: Define and manage user roles with granular permissions
- **Business Management**: Multi-business/tenant support with business configuration
- **Module Management**: Dynamic module configuration and permission assignment
- **System Configuration**: Global system settings including branding, date/time formats, and email configuration
- **Activity Logging**: Comprehensive audit trail of all system activities
- **Email Logging**: Track and monitor all email communications
- **Security**: Two-factor authentication, FCM token management, and secure access control

---

## Architecture

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ System Users │  │  User Roles  │  │  Business    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Modules    │  │Configuration │  │Activity Logs │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Email Logs                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ SystemUsers  │  │  UserRoles   │  │  Business    │     │
│  │ Controller  │  │ Controller   │  │ Controller   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Modules     │  │Configuration │  │ActivityLogs  │     │
│  │ Controller   │  │ Controller   │  │ Controller   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Email Logs Controller                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MongoDB Database                          │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │System  │ │ User   │ │Business│ │Modules │        │   │
│  │  │Users   │ │ Roles  │ │        │ │        │        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  │  ┌────────┐ ┌────────┐                              │   │
│  │  │Activity│ │ Email  │                              │   │
│  │  │ Logs   │ │ Logs   │                              │   │
│  │  └────────┘ └────────┘                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Module Dependencies
```
Global Settings Module
├── Authentication System (External)
├── Email Service (External)
├── File Upload Service (External)
├── Notification System (External)
└── All Application Modules (for permission assignment)
```

---

## Submodules

The Global Settings module consists of 7 interconnected submodules:

### 1. System Users
**Path**: `/SystemUsers`  
**Frontend**: `src/pages/RoleBaseAccess/SystemUsers.jsx`  
**Backend**: `SystemUsers/`

**Purpose**: Complete system user lifecycle management including creation, updates, authentication, and access control.

**Key Features**:
- Create, update, and delete system users
- User authentication and password management
- Role assignment to users
- Business assignment (multi-business support)
- User status management (active/inactive)
- Profile image upload
- Two-factor authentication support
- FCM token management for push notifications (web, mobile, HR mobile)
- OTP generation and validation
- User signature management
- Contact information management

**User Fields**:
- Name, Last Name
- Email (unique, required)
- Password (hashed)
- Contact
- Image/Profile Picture
- Signature
- Role (reference to User_Roles)
- Businesses (array of business IDs)
- Status (Boolean)
- FCM Tokens (web, mobile, hr_mobile)
- Two-Factor Authentication flag

### 2. User Roles
**Path**: `/UserRoles`  
**Frontend**: `src/pages/RoleBaseAccess/UserRoles.jsx`  
**Backend**: `UserRoles/`

**Purpose**: Define and manage user roles with module-based permissions and access control.

**Key Features**:
- Create, update, and delete user roles
- Role name and landing page configuration
- Module assignment with granular permissions
- Status toggle (active/inactive)
- View assigned users for each role
- Permission-based access control
- Landing page routing configuration

**Role Fields**:
- Name (required, unique)
- Landing Page (required) - default route for role
- Modules (array) - assigned modules with permissions
- Status (Boolean, default: true)

**Permission Types**:
- Add
- Update
- Delete
- BulkDelete
- View
- ViewDetails
- Send For Approval (for Sales module)
- Approve Sales (for Sales module)
- And more module-specific permissions

### 3. Business
**Path**: `/business`  
**Frontend**: `src/pages/Business/Business.jsx`  
**Backend**: `Business/`

**Purpose**: Manage business entities (multi-tenant support) with business-specific configurations.

**Key Features**:
- Create, update, and delete businesses
- Business information management (name, email, contact)
- Business status management (Active/Inactive)
- Business image/logo upload
- Unique business name and email enforcement
- Business details configuration
- Delivery settings
- Zoho integration
- Lalamove integration
- Own shipment configuration
- Rewards points configuration
- E-Invoice settings

**Business Fields**:
- Name (required, unique)
- Email (required, unique, lowercase)
- Fax
- Tel (Telephone)
- Address
- Image/Logo
- Status (default: "Active")

### 4. Modules
**Path**: `/Modules`  
**Frontend**: `src/pages/Modules/Modules.jsx`  
**Backend**: `Modules/`

**Purpose**: Dynamic module management with hierarchical structure and permission configuration.

**Key Features**:
- Create, update, and delete modules
- Hierarchical module structure (parent-child relationships)
- Module path and icon configuration
- Position/ordering management
- Permission configuration per module
- Status management (active/inactive)
- Dynamic module loading for users
- Sub-module support
- Module uniqueness validation

**Module Fields**:
- Name (required, unique)
- Path (route path)
- Icon (icon identifier)
- Parent ID (reference to parent module)
- Position (ordering number)
- Permissions (object with permission types)
- Status (Boolean)

**Module Hierarchy**:
- Parent modules (e.g., "Operations")
- Sub-modules (e.g., "Shipment", "Cargo Readiness", "Request for Quotation", "Shipping Documents", "Stock Positions")

### 5. Configurations
**Path**: `/Configuration`  
**Frontend**: `src/pages/Configuration/Configurations.jsx`  
**Backend**: `routes/configurationRoute.js`

**Purpose**: Global system configuration including branding, date/time formats, and email settings.

**Key Features**:
- System logo upload and management
- Color scheme configuration:
  - Button colors
  - Top bar color
  - Left sidebar color
  - Button text color
- Date format configuration
- Time format configuration
- Email configuration (SMTP settings)
- System-wide settings management
- Latest configuration retrieval

**Configuration Fields**:
- System Logo
- Buttons Color
- Topbar Color
- Leftbar Color
- Buttons Text Color
- Date Format
- Time Format
- Email Configuration (SMTP settings)
- Other system-wide settings

### 6. Activity Logs
**Path**: `/ActivityLogs`  
**Frontend**: `src/pages/ActivityLogs/ActivityLogs.jsx`  
**Backend**: `ActivityLogs/`

**Purpose**: Comprehensive audit trail of all system activities and user actions.

**Key Features**:
- Track all user actions across the system
- Collection-based logging (which database collection was affected)
- Action tracking (Create, Update, Delete, etc.)
- Function tracking (which function/endpoint was called)
- Previous and new data comparison
- Date and time tracking
- User identification
- Detailed activity view
- Search and filter capabilities
- Pagination support

**Activity Log Fields**:
- User ID (reference to user)
- Collection (database collection name)
- Action (action type: Create, Update, Delete, etc.)
- Function (function/endpoint name)
- Date (timestamp)
- Previous Data (object - before change)
- New Data (object - after change)

**Tracked Actions**:
- Create operations
- Update operations
- Delete operations
- Status changes
- Permission changes
- And more...

### 7. Email Logs
**Path**: `/EmailLogs`  
**Frontend**: `src/pages/EmailLogs/EmailLogs.jsx`  
**Backend**: `routes/emailLogs.js`

**Purpose**: Track and monitor all email communications sent through the system.

**Key Features**:
- Email sending history
- Email status tracking (sent, failed, pending)
- Recipient information
- Email content tracking
- Timestamp tracking
- Email statistics and monitoring
- Reset email statistics
- Detailed email log view
- Search and filter capabilities

**Email Log Fields**:
- Recipient email
- Subject
- Content/Body
- Status (sent, failed, pending)
- Sent Date/Time
- Error messages (if failed)
- Template used (if applicable)
- Additional metadata

**Email Statistics**:
- Total emails sent
- Successful sends
- Failed sends
- Pending sends
- Success rate
- Error rate

---

## API Documentation

### Base URLs
- System Users: `/api/SystemUsers/` or `/api/system-users/`
- User Roles: `/api/UserRoles/`
- Business: `/api/Business/`
- Modules: `/api/Module/`
- Configuration: `/api/configuration`
- Activity Logs: `/api/ActivityLogs/`
- Email Logs: `/api/email-logs`

### Authentication
Most endpoints require authentication via `isAuth` middleware. Token should be included in the Authorization header.

### System Users APIs

#### Create System User
```
POST /api/SystemUsers/add
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  name: String,
  last_name: String,
  email: String (required, unique),
  password: String (required),
  contact: String,
  role: ObjectId (ref: "User_Roles"),
  businesses: [ObjectId],
  status: Boolean,
  signature: String,
  image: String,
  two_factor_auth: Boolean
}
```

#### Get All System Users
```
POST /api/SystemUsers/get_all
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: Boolean,
  role: ObjectId
}
```

#### Get System Users (Filtered)
```
POST /api/SystemUsers/get_all_system_users
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: Boolean,
  role: ObjectId
}
```

#### Get Single System User
```
POST /api/SystemUsers/get_single/:_id
Authorization: Bearer <token>
```

#### Update System User
```
PUT /api/SystemUsers/update/:_id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Delete System User
```
DELETE /api/SystemUsers/delete/:_id
Authorization: Bearer <token>
```

#### Update FCM Token
```
POST /api/SystemUsers/update-fcm-token
Content-Type: application/json

Request Body:
{
  userId: ObjectId,
  token: String,
  platform: String // "web", "mobile", "hr_mobile"
}
```

#### Remove FCM Token
```
POST /api/SystemUsers/remove-fcm-token
Content-Type: application/json

Request Body:
{
  userId: ObjectId,
  platform: String
}
```

### User Roles APIs

#### Create User Role
```
POST /api/UserRoles/add
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  name: String (required),
  landing_page: String (required),
  modules: Array (required),
  status: Boolean (default: true)
}
```

#### Get All User Roles
```
POST /api/UserRoles/get_all
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: Boolean
}
```

#### Get User Roles (Filtered)
```
POST /api/UserRoles/get_all_user_roles
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: Boolean
}
```

#### Get Single User Role
```
POST /api/UserRoles/get_single/:_id
```

#### Update User Role
```
PUT /api/UserRoles/update/:_id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Toggle User Role Status
```
PUT /api/UserRoles/toggle-status/:id
Content-Type: application/json

Request Body:
{
  status: Boolean
}
```

#### Get Assigned Users
```
GET /api/UserRoles/get-assigned-users/:id
Authorization: Bearer <token>
```

#### Delete User Role
```
DELETE /api/UserRoles/delete/:_id
Authorization: Bearer <token>
```

### Business APIs

#### Create Business
```
POST /api/Business/add
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  name: String (required, unique),
  email: String (required, unique),
  fax: String,
  tel: String,
  address: String,
  image: String,
  status: String (default: "Active")
}
```

#### Get All Businesses
```
POST /api/Business/getALL
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: String
}
```

#### Get Business by ID
```
GET /api/Business/:id
```

#### Get Single Business
```
POST /api/Business/get_single
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  id: ObjectId
}
```

#### Update Business
```
PUT /api/Business/update/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Update Business Status
```
PUT /api/Business/status/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  status: String
}
```

#### Delete Business
```
DELETE /api/Business/delete/:id
Authorization: Bearer <token>
```

### Modules APIs

#### Create Module
```
POST /api/Module/add
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  name: String (required, unique),
  path: String,
  icon: String,
  parent_id: ObjectId (ref: "Modules"),
  position: Number,
  permissions: Object,
  status: Boolean
}
```

#### Get All Modules
```
POST /api/Module/get_all
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: Boolean,
  parent_id: ObjectId
}
```

#### Get Modules (Filtered)
```
POST /api/Module/get_all_modules
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  status: Boolean
}
```

#### Get Dynamic Modules (User-Specific)
```
GET /api/Module/get_Dynamic_Modules/:user_id
```

**Response**: Returns modules accessible to the user based on their role permissions.

#### Get Single Module
```
POST /api/Module/get_single/:_id
Content-Type: application/json

Request Body:
{
  _id: ObjectId
}
```

#### Update Module
```
PUT /api/Module/update/:_id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Delete Module
```
DELETE /api/Module/delete/:_id
Authorization: Bearer <token>
```

### Configuration APIs

#### Create Configuration
```
POST /api/configuration
Content-Type: multipart/form-data

Request Body:
{
  system_logo: File,
  buttons_color: String,
  topbar_color: String,
  leftbar_color: String,
  buttons_text_color: String,
  date_format: String,
  time_format: String,
  // Email configuration
  email_host: String,
  email_port: Number,
  email_user: String,
  email_password: String,
  email_from: String
}
```

#### Get All Configurations
```
GET /api/configuration
```

#### Get Latest Configuration
```
GET /api/configuration
```

#### Get Configuration by ID
```
GET /api/configuration/:id
```

#### Get Configuration by User Email
```
GET /api/configuration/user/:email
```

#### Update Configuration
```
PUT /api/configuration/:id
Content-Type: multipart/form-data

Request Body: (Same structure as create, all fields optional)
```

#### Delete Configuration
```
DELETE /api/configuration/:id
Authorization: Bearer <token>
```

### Activity Logs APIs

#### Get All Activity Logs
```
POST /api/ActivityLogs/getALL
Content-Type: application/json

Request Body:
{
  page: Number,
  limit: Number,
  search: String,
  user_id: ObjectId,
  Collection: String,
  Action: String,
  dateFrom: Date,
  dateTo: Date
}
```

#### Get Single Activity Log
```
POST /api/ActivityLogs/get_single
Content-Type: application/json

Request Body:
{
  _id: ObjectId
}
```

### Email Logs APIs

#### Get All Email Logs
```
GET /api/email-logs?page=1&limit=10
```

#### Get Email Statistics
```
GET /api/email-logs/stats
```

**Response**:
```json
{
  "totalSent": Number,
  "successful": Number,
  "failed": Number,
  "pending": Number,
  "successRate": Number,
  "errorRate": Number
}
```

#### Reset Email Statistics
```
POST /api/email-logs/stats/reset
```

---

## Data Models

### System Users Model

```javascript
{
  name: String,
  last_name: String,
  signature: String,
  email: String (required, unique),
  image: String,
  password: String (required, hashed),
  contact: String,
  role: ObjectId (ref: "User_Roles"),
  businesses: [ObjectId],
  status: Boolean,
  otp: String,
  otpExpires: Date,
  fcm_token: String, // Legacy single token
  fcm_tokens: {
    web: String,
    mobile: String,
    hr_mobile: String
  },
  token: String, // JWT token
  two_factor_auth: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Email uniqueness enforced at database level
- Password hashing (bcrypt)
- Multiple FCM token support for different platforms
- OTP support for two-factor authentication
- Business array for multi-business access

### User Roles Model

```javascript
{
  name: String (required, unique),
  landing_page: String (required),
  modules: [{
    moduleId: ObjectId,
    permissions: {
      Add: Boolean,
      Update: Boolean,
      Delete: Boolean,
      BulkDelete: Boolean,
      View: Boolean,
      ViewDetails: Boolean,
      // Module-specific permissions
      "Send For Approval": Boolean,
      "Approve Sales": Boolean
    }
  }],
  status: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Name uniqueness enforced
- Module-based permission structure
- Granular permission control
- Status toggle for enabling/disabling roles

### Business Model

```javascript
{
  name: String (required, unique),
  email: String (required, unique, lowercase),
  fax: String,
  tel: String,
  address: String,
  image: String,
  status: String (default: "Active", enum: ["Active", "Inactive"]),
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Name and email uniqueness enforced
- Email stored in lowercase for case-insensitive matching
- Status management
- Image/logo support

### Modules Model

```javascript
{
  name: String (required, unique),
  path: String,
  icon: String,
  parent_id: ObjectId (ref: "Modules"),
  position: Number,
  permissions: {
    Add: Boolean,
    Update: Boolean,
    Delete: Boolean,
    BulkDelete: Boolean,
    View: Boolean,
    ViewDetails: Boolean
  },
  status: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Name uniqueness enforced
- Hierarchical structure via parent_id
- Position for ordering
- Permission template
- Pre-save hook for uniqueness validation

**Validation**:
- Pre-save hook checks for duplicate names/paths
- Parent-child relationship validation

### Activity Logs Model

```javascript
{
  user_id: ObjectId (required),
  Collection: String (required), // Database collection name
  Action: String (required), // "Create", "Update", "Delete", etc.
  Function: String (required), // Function/endpoint name
  Date: Date (required),
  previousData: Object, // Data before change
  newData: Object, // Data after change
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Comprehensive audit trail
- Before/after data comparison
- Collection and action tracking
- Timestamp tracking

### Email Logs Model

```javascript
{
  to: String (required), // Recipient email
  subject: String,
  body: String,
  html: String,
  status: String (enum: ["sent", "failed", "pending"]),
  error: String, // Error message if failed
  templateId: ObjectId, // Reference to email template
  metadata: Object, // Additional metadata
  sentAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Email status tracking
- Error logging
- Template reference
- Metadata support

### Configuration Model

```javascript
{
  system_logo: String, // File path or URL
  buttons_color: String,
  topbar_color: String,
  leftbar_color: String,
  buttons_text_color: String,
  date_format: String,
  time_format: String,
  // Email configuration
  email_host: String,
  email_port: Number,
  email_user: String,
  email_password: String, // Encrypted
  email_from: String,
  email_secure: Boolean,
  // Additional settings
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features**:
- Single configuration record (typically)
- Color scheme management
- Date/time format configuration
- Email SMTP settings
- Logo management

---

## Frontend Structure

### Directory Structure
```
src/pages/
├── RoleBaseAccess/
│   ├── UserRoles.jsx              # User Roles management page
│   └── SystemUsers.jsx             # System Users management page
│
├── Business/
│   ├── Business.jsx                # Business listing and management
│   ├── BasicInfo.jsx               # Business basic information
│   ├── BusinessDetails.jsx         # Business details configuration
│   ├── Delivery.jsx                # Delivery settings
│   ├── EInvoice.jsx                # E-Invoice configuration
│   ├── General.jsx                 # General settings
│   ├── Lalamove.jsx                # Lalamove integration
│   ├── OwnShipment.jsx             # Own shipment settings
│   ├── RewardsPoints.jsx           # Rewards points configuration
│   ├── Shipment.jsx                # Shipment settings
│   ├── viewBusinessDetails.jsx     # Business details view
│   └── Zoho.jsx                    # Zoho integration
│
├── Modules/
│   ├── Modules.jsx                 # Module management page
│   ├── BasicInfo.jsx               # Module basic information
│   ├── BusinessDetails.jsx        # Module business details
│   └── [other module config pages]
│
├── Configuration/
│   ├── Configurations.jsx          # Main configuration page
│   ├── ConfigTab.jsx               # Configuration tabs
│   └── TabEmailConfig.jsx         # Email configuration tab
│
├── ActivityLogs/
│   ├── ActivityLogs.jsx           # Activity logs listing
│   └── viewActivityLogsDetails.jsx # Activity log detail view
│
├── EmailLogs/
│   ├── EmailLogs.jsx               # Email logs listing
│   └── viewEmailLogsDetails.jsx    # Email log detail view
│
└── Settings/
    └── Setting.jsx                 # Settings landing page
```

### Key Frontend Components

#### User Roles Page (`UserRoles.jsx`)
- Role listing with pagination
- Create/Edit role modal
- Module selection with permission checkboxes
- Landing page selection
- Status toggle
- View assigned users modal
- Search and filter functionality

#### System Users Page (`SystemUsers.jsx`)
- User listing with pagination
- Create/Edit user modal
- Role assignment dropdown
- Business multi-select
- Profile image upload
- Password management
- Status toggle
- Search and filter functionality

#### Business Page (`Business.jsx`)
- Business listing with pagination
- Create/Edit business modal
- Business image/logo upload
- Status management
- Business details configuration tabs
- Search and filter functionality

#### Modules Page (`Modules.jsx`)
- Module listing with hierarchical display
- Create/Edit module modal
- Parent module selection
- Permission configuration
- Icon selection
- Position/ordering management
- Status toggle
- Search and filter functionality

#### Configuration Page (`Configurations.jsx`)
- System logo upload
- Color picker for theme colors
- Date format selector
- Time format selector
- Email SMTP configuration
- Save and preview functionality

#### Activity Logs Page (`ActivityLogs.jsx`)
- Activity log listing with pagination
- Filter by user, collection, action, date range
- Detailed activity view
- Before/after data comparison
- Search functionality

#### Email Logs Page (`EmailLogs.jsx`)
- Email log listing with pagination
- Email status indicators
- Email statistics display
- Detailed email view
- Search and filter functionality

### Services Layer
**File**: `src/services/SettingServices.js` (if exists)

API service methods for Global Settings module operations.

### Key Frontend Technologies
- **React**: UI framework
- **React Router**: Navigation
- **Axios**: API communication
- **Context API**: State management (AdminContext, SidebarContext)
- **React Icons**: Icon library
- **Windmill React UI**: UI component library
- **React Color**: Color picker component
- **Custom Components**: Reusable UI components from `@/page-layouts`

---

## Backend Structure

### Directory Structure
```
Backend/
├── SystemUsers/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── UserRoles/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── Business/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   ├── model.js                     # Mongoose schema
│   ├── BusinessDelivery/            # Delivery settings
│   ├── BusinessDetails/            # Business details
│   ├── BusinessZoho/               # Zoho integration
│   ├── Rewardpoint/                # Rewards points
│   ├── GeneralBusness/             # General settings
│   ├── BusnessLalamove/            # Lalamove integration
│   └── Ownshipment/                 # Own shipment
│
├── Modules/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── ActivityLogs/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── routes/
│   ├── configurationRoute.js        # Configuration routes
│   └── emailLogs.js                 # Email logs routes
│
└── controller/
    └── configurationController.js   # Configuration controller
```

### Route Registration
Routes are registered in `index.js`:
```javascript
app.use("/api/SystemUsers/", SystemUsers);
app.use("/api/system-users/", SystemUsers);
app.use("/api/UserRoles/", UserRoles);
app.use("/api/Business/", BusinessRoutes);
app.use("/api/Module/", ModulesRoutes);
app.use("/api/ActivityLogs/", ActivityLogsRoutes);
app.use("/api/configuration", configurationRoutes);
app.use("/api/email-logs", emailLogsRoute);
```

### Middleware
- **isAuth**: Authentication middleware (required for most routes)
- **uploadMiddleware**: File upload middleware for images/logos
- **Error Handling**: Centralized error handling
- **Validation**: Request validation (implemented in controllers)

---

## Integration Points

### External Module Dependencies

#### 1. Authentication System
- **Used By**: System Users
- **Purpose**: User authentication and authorization
- **Integration**: JWT tokens, password hashing, session management

#### 2. Email Service
- **Used By**: Email Logs, Configuration
- **Purpose**: Send emails and track email communications
- **Integration**: SMTP configuration, email templates

#### 3. File Upload Service
- **Used By**: System Users, Business, Configuration
- **Purpose**: Upload profile images, business logos, system logos
- **Integration**: AWS S3 or local file storage

#### 4. Notification System
- **Used By**: System Users
- **Purpose**: Push notifications via FCM
- **Integration**: FCM token management

#### 5. All Application Modules
- **Used By**: User Roles, Modules
- **Purpose**: Permission assignment and module configuration
- **Integration**: Module references, permission mapping

### Data Flow Between Submodules

```
┌─────────────────┐
│    Business     │
│  (Multi-tenant) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  System Users   │
│  (User Mgmt)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   User Roles    │
│  (Permissions)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Modules      │
│  (Access Ctrl)  │
└─────────────────┘

┌─────────────────┐
│  Configuration  │
│  (System Setup)  │
└─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│ Activity Logs   │      │   Email Logs    │
│  (Audit Trail)  │      │  (Email Track)  │
└─────────────────┘      └─────────────────┘
```

---

## Workflows

### User Creation and Role Assignment Workflow

1. **Create User Role**
   - Define role name
   - Set landing page
   - Assign modules with permissions
   - Set status (active/inactive)

2. **Create System User**
   - Enter user details (name, email, password)
   - Assign role (from created roles)
   - Assign businesses (multi-business support)
   - Upload profile image (optional)
   - Set status (active/inactive)
   - Enable two-factor authentication (optional)

3. **User Login**
   - Authenticate with email/password
   - If 2FA enabled, verify OTP
   - Generate JWT token
   - Load user modules based on role
   - Redirect to landing page

4. **Module Access**
   - System checks user's role
   - Loads assigned modules
   - Applies permission checks
   - Renders UI based on permissions

### Business Setup Workflow

1. **Create Business**
   - Enter business information (name, email, contact)
   - Upload business logo
   - Set status (Active/Inactive)

2. **Configure Business Details**
   - General settings
   - Delivery settings
   - E-Invoice configuration
   - Zoho integration
   - Lalamove integration
   - Own shipment settings
   - Rewards points configuration

3. **Assign Users to Business**
   - Select system users
   - Assign to business
   - Users can now access business-specific data

### Module Management Workflow

1. **Create Parent Module**
   - Define module name
   - Set path and icon
   - Configure permissions template
   - Set position/order

2. **Create Sub-Module**
   - Define sub-module name
   - Set parent module
   - Set path and icon
   - Configure permissions
   - Set position/order

3. **Assign Modules to Roles**
   - Select role
   - Choose modules to assign
   - Configure permissions per module
   - Save role configuration

### Configuration Workflow

1. **Configure System Settings**
   - Upload system logo
   - Set color scheme (buttons, topbar, sidebar)
   - Configure date/time formats
   - Save configuration

2. **Configure Email Settings**
   - Enter SMTP host and port
   - Set email credentials
   - Configure email from address
   - Test email connection
   - Save email configuration

3. **Apply Configuration**
   - Configuration applied system-wide
   - All users see updated branding
   - Email service uses new SMTP settings

### Activity Logging Workflow

1. **User Action**
   - User performs action (create, update, delete)
   - System captures action details

2. **Log Creation**
   - Create activity log entry
   - Record user ID
   - Record collection name
   - Record action type
   - Record function/endpoint
   - Store previous data (if update)
   - Store new data
   - Record timestamp

3. **Log Retrieval**
   - Admin views activity logs
   - Filter by user, collection, action, date
   - View detailed activity information
   - Compare before/after data

### Email Logging Workflow

1. **Email Sending**
   - System sends email
   - Create email log entry
   - Record recipient, subject, body
   - Record status (sent, failed, pending)

2. **Status Tracking**
   - Update email status
   - Record error if failed
   - Record sent timestamp

3. **Log Retrieval**
   - Admin views email logs
   - Check email statistics
   - View email details
   - Monitor email delivery

---

## Technical Implementation Details

### Authentication and Authorization

#### Password Hashing
- Passwords are hashed using bcrypt
- Salt rounds: 10 (configurable)
- Never store plain text passwords

#### JWT Token Management
- Tokens generated on successful login
- Token stored in user model (optional, for device management)
- Token expiration handled by middleware
- Token refresh mechanism (if implemented)

#### Two-Factor Authentication
- OTP generation on login (if enabled)
- OTP expiration: 5 minutes
- OTP stored in user model with expiration time
- Email-based OTP delivery

### FCM Token Management

#### Multi-Platform Support
- Separate tokens for web, mobile, and HR mobile
- Token update endpoint for each platform
- Token removal on logout or device change
- Legacy single token support maintained

#### Token Storage
```javascript
fcm_tokens: {
  web: String,
  mobile: String,
  hr_mobile: String
}
```

### Permission System

#### Permission Types
- **Add**: Create new records
- **Update**: Modify existing records
- **Delete**: Remove records
- **BulkDelete**: Delete multiple records
- **View**: View list of records
- **ViewDetails**: View detailed record information
- **Module-Specific**: Custom permissions per module

#### Permission Checking
- Frontend: Check permissions before rendering UI elements
- Backend: Validate permissions in controllers
- Middleware: Permission validation middleware (if implemented)

### Module Hierarchy

#### Parent-Child Relationship
- Modules can have parent modules
- Sub-modules inherit some properties from parent
- Hierarchical navigation structure
- Permission inheritance (if configured)

#### Dynamic Module Loading
- User-specific module list based on role
- Filtered by permissions
- Ordered by position
- Rendered in navigation sidebar

### Business Multi-Tenancy

#### Business Isolation
- Users assigned to specific businesses
- Data filtered by business ID
- Business-specific configurations
- Cross-business access control

#### Business Assignment
- Users can belong to multiple businesses
- Business array in user model
- Business selection on login (if multiple)
- Business context in API requests

### Activity Logging

#### Automatic Logging
- Logs created automatically on actions
- No manual logging required
- Captures all CRUD operations
- Tracks status changes

#### Log Structure
- User identification
- Collection/table name
- Action type
- Function/endpoint
- Before/after data comparison
- Timestamp

### Email Logging

#### Email Tracking
- All emails logged automatically
- Status tracking (sent, failed, pending)
- Error logging for failed emails
- Statistics calculation

#### Email Statistics
- Total emails sent
- Success rate
- Failure rate
- Pending count
- Real-time statistics

### Configuration Management

#### Single Configuration Record
- Typically one configuration record
- Latest configuration retrieved
- Configuration updates affect entire system
- Caching for performance (if implemented)

#### Color Scheme
- Color picker for theme customization
- RGB/HEX color support
- Preview before save
- Applied globally

#### Date/Time Formats
- Configurable date formats
- Configurable time formats
- Applied system-wide
- User preference override (if implemented)

### Validation and Error Handling

#### Input Validation
- Required field validation
- Unique constraint validation
- Email format validation
- Password strength validation (if implemented)

#### Error Responses
```json
{
  "error": "Error message",
  "details": "Additional error details",
  "field": "Field name (if field-specific)"
}
```

### Security Features

#### Data Protection
- Password hashing
- Email uniqueness enforcement
- Business name uniqueness
- Role name uniqueness
- Module name uniqueness

#### Access Control
- Authentication required for most endpoints
- Role-based permission checking
- Business-based data isolation
- Activity logging for audit

#### Token Security
- JWT token expiration
- Token validation middleware
- Secure token storage
- Token refresh mechanism

---

## Best Practices

### Frontend
1. **State Management**: Use React Context for global state (AdminContext, SidebarContext)
2. **API Calls**: Use service layer for all API interactions
3. **Error Handling**: Implement try-catch blocks for all API calls
4. **Loading States**: Show loading indicators during API calls
5. **Pagination**: Implement pagination for large datasets
6. **Form Validation**: Validate forms before submission
7. **Permission Checking**: Check permissions before rendering UI elements

### Backend
1. **Validation**: Validate all input data in controllers
2. **Error Handling**: Use consistent error response format
3. **Database Queries**: Use indexes for performance
4. **Middleware**: Apply authentication middleware where needed
5. **Logging**: Log important operations for debugging
6. **Password Security**: Always hash passwords before storing
7. **Uniqueness**: Enforce uniqueness constraints at database level

### Database
1. **Indexes**: Create indexes on frequently queried fields
   - Email fields (unique index)
   - Name fields (unique index)
   - User ID in activity logs
   - Business ID in user businesses array
2. **References**: Use proper references for related entities
3. **Validation**: Enforce schema validation
4. **Timestamps**: Use Mongoose timestamps for audit trails
5. **Data Integrity**: Use transactions for multi-step operations

### Security
1. **Password Hashing**: Never store plain text passwords
2. **Token Management**: Secure token storage and validation
3. **Input Sanitization**: Sanitize all user inputs
4. **SQL Injection Prevention**: Use parameterized queries (Mongoose handles this)
5. **XSS Prevention**: Sanitize output data
6. **CSRF Protection**: Implement CSRF tokens (if applicable)

---

## Future Enhancements

### Planned Features
1. **Advanced Permissions**: More granular permission system
2. **Role Templates**: Pre-defined role templates
3. **User Groups**: Group users for easier management
4. **Audit Reports**: Advanced audit reporting and analytics
5. **Email Templates**: Email template management in configuration
6. **Multi-Language Support**: System-wide language configuration
7. **API Rate Limiting**: Rate limiting for API endpoints
8. **Session Management**: Advanced session management
9. **Device Management**: Track and manage user devices
10. **Backup and Restore**: Configuration backup and restore

### Performance Optimizations
1. **Caching**: Redis caching for frequently accessed data
2. **Database Optimization**: Query optimization and indexing
3. **CDN Integration**: CDN for static assets
4. **Background Jobs**: Queue system for heavy operations
5. **Data Archiving**: Archive old activity and email logs

---

## Troubleshooting

### Common Issues

#### 1. User Cannot Login
- **Issue**: User credentials not working
- **Solution**: Check password hashing, verify email exists, check user status
- **Check**: Verify user status is active, check role assignment

#### 2. Permission Denied
- **Issue**: User cannot access module/feature
- **Solution**: Check role permissions, verify module assignment
- **Check**: Verify user's role has required permissions

#### 3. Business Not Found
- **Issue**: Business not accessible to user
- **Solution**: Check business assignment, verify business status
- **Check**: Verify user is assigned to business, check business status

#### 4. Module Not Showing
- **Issue**: Module not visible in navigation
- **Solution**: Check module status, verify role assignment, check permissions
- **Check**: Verify module is active, user's role has module assigned

#### 5. Configuration Not Applied
- **Issue**: Configuration changes not reflected
- **Solution**: Clear cache, verify configuration save, check latest configuration retrieval
- **Check**: Verify configuration was saved, check if using latest configuration

#### 6. Activity Logs Not Recording
- **Issue**: Activities not being logged
- **Solution**: Check logging middleware, verify activity log creation
- **Check**: Verify activity logging is enabled, check database connection

#### 7. Email Not Sending
- **Issue**: Emails not being sent
- **Solution**: Check SMTP configuration, verify email service, check email logs
- **Check**: Verify SMTP settings, check email service status, review email logs

---

## API Response Examples

### Success Response
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### Error Response
```json
{
  "error": "User not found",
  "details": "No user found with ID: 507f1f77bcf86cd799439011"
}
```

### Single Entity Response
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Admin User",
  "email": "admin@example.com",
  "role": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Super Admin"
  },
  "businesses": [...],
  "status": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Conclusion

The Global Settings module provides a comprehensive, integrated solution for system administration, user management, role-based access control, and system configuration. With its seven interconnected submodules, the system offers centralized control, security, audit capabilities, and flexible configuration options. The modular design ensures scalability while maintaining seamless integration between different administrative aspects.

For additional support or questions, please refer to the individual submodule documentation files or contact the development team.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Development Team

