# Simple File Server

A web-based file server application that allows you to browse and view local files through a web interface. It supports three different view modes: List View, Grid View, and Image View, along with file search functionality.

## Features

- Browse local files and directories
- Three view modes: List, Grid, and Image
- File search functionality
- Preview images directly in the browser
- Download files

## Project Structure

The project consists of two main parts:

1. **Backend**: A simple Express server that serves files from a configured directory
2. **Frontend**: A Next.js application with a modern UI built using shadcn/ui components

## Setup and Installation

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure the base directory in `config.js` (default is `D:/Files`):
   ```javascript
   module.exports = {
     baseDirectory: process.env.BASE_DIRECTORY || 'D:/Files',
     // other settings...
   };
   ```

4. Start the backend server:
   ```
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the frontend development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Technologies Used

- **Backend**:
  - Express.js
  - Node.js file system API

- **Frontend**:
  - Next.js
  - React
  - Tailwind CSS
  - shadcn/ui components
  - Tanstack React Query
  - Axios

## Usage

1. Browse through your files by clicking on directories
2. Use the navigation buttons to go back or to the home directory
3. Switch between view modes using the buttons in the top-right corner
4. Search for files using the search bar
5. Click on files to download or view them # SimpleFileServer
