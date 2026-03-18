# API Documentation

## Overview
This API allows developers to integrate with our service seamlessly. 

## Base URL
`https://api.example.com/`

## Authentication
- All API requests require an API key.
- You can obtain your API key from the [developer portal](https://developer.example.com).
- Use the following format for authentication:
  
  ```
  Authorization: Bearer YOUR_API_KEY
  ```

## Rate Limiting
- Each user is allowed up to 1000 requests per hour.
- If you exceed your limit, you will receive a `429 Too Many Requests` response.

## Endpoints
### 1. Get User Information
- **Endpoint**: `GET /users/{id}`  
- **Description**: Retrieve information about a specific user.
- **Authentication**: Required
- **Response**:
    ```json
    {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com"
    }
    ```
- **Error Responses**:
    - `404 Not Found`: User not found.
    - `401 Unauthorized`: Authentication failed.

### Example:
```javascript
fetch('https://api.example.com/users/123', {
    method: 'GET',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
    }
})
.then(response => response.json())
.then(data => console.log(data));
```

### 2. Create New User
- **Endpoint**: `POST /users`  
- **Description**: Create a new user in the system.
- **Request Body**:
    ```json
    {
        "name": "New User",
        "email": "newuser@example.com"
    }
    ```
- **Authentication**: Required
- **Response**:
    ```json
    {
        "id": 124,
        "name": "New User",
        "email": "newuser@example.com"
    }
    ```
- **Error Responses**:
    - `400 Bad Request`: Invalid input.
    - `401 Unauthorized`: Authentication failed.

### Example:
```javascript
fetch('https://api.example.com/users', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({ name: 'New User', email: 'newuser@example.com'})
})
.then(response => response.json())
.then(data => console.log(data));
```

### 3. Update User Information
- **Endpoint**: `PUT /users/{id}`  
- **Description**: Update the information of an existing user.
- **Request Body**:
    ```json
    {
        "name": "Updated User"
    }
    ```
- **Authentication**: Required
- **Error Responses**:
    - `404 Not Found`: User not found.
    - `401 Unauthorized`: Authentication failed.

### Example:
```javascript
fetch('https://api.example.com/users/124', {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({ name: 'Updated User' })
})
.then(response => response.json())
.then(data => console.log(data));
```  

### Conclusion
This API documentation provides endpoints along with necessary instructions for authenticating and handling responses. Make sure to handle errors properly in your implementation.