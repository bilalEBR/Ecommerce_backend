# ecommerce_local backend

This project is a starting point for a Node.js backend application that powers the ecommerce_local Flutter app. It handles API requests for product management, user roles (users, sellers, admins), real-time chat, and order verification.
Set Up Environment
To run this backend locally or deploy it, follow these steps:

## Install Dependencies:

Ensure you have Node.js installed (see Node.js Installation Guide). Then, install the required packages:
```bash
npm install
```

## Set Up Environment:

Create a .env file in the backend root directory.

I will send you to the mongo atlas database URL by telegram because it has a sensetive data(security) though i can't directly place here.

Example:  after creating .env file in the root directory 
 and copy from your telegram and paste like as this in newly created .env file
 
```bash
 "MONGODB_URI=mongodb+srv://<username>:<password>@ecommerce.8rkpkii.mongodb.net/?retryWrites=true&w=majority&appName=ecommerce"
```
if you want local development Ensure you have  starting the backend running locally on http://localhost:3000 

 ```bash
node main.js
```





