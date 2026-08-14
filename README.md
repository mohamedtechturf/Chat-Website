# Chat-Website 💬

A lightweight, private, and localized chat application built to facilitate secure real-time communication within a local area network (LAN) or private environment.

## 🚀 Features

*   **Private & Local:** Complete data privacy—all conversations stay strictly within your local network.
*   **Real-Time Messaging:** Instantaneous text communication powered by Node.js.
*   **Zero-Configuration Launch:** Includes a single-click startup script for Windows environments.
*   **Clean Web UI:** Straightforward user interface designed with responsive HTML and CSS.

---

## 🛠️ Tech Stack

*   **Backend:** Node.js
*   **Frontend:** HTML5, CSS3, JavaScript (Client-side)
*   **Process Management:** npm (Package ecosystem)

---

## 📦 Prerequisites

Before running the application, make sure you have the following installed on your machine:

1.  **Node.js** (v14.x or higher recommended) -> [Download Node.js](https://nodejs.org)
2.  **npm** (Automatically bundled with Node.js)

---

## 💻 Installation & Setup

Follow these quick steps to get your private local chat server up and running:

### 1. Clone the Repository
```bash
git clone https://github.com/mohamedtechturf/Chat-Website
cd Chat-Website
```

### 2. Install Dependencies
Run the following command in your terminal to install the required node modules:
```bash
npm install
```

### 3. Start the Server

#### On Windows (Quickest Method):
Simply double-click the pre-configured batch file in the root directory:
```text
run.bat
```

#### On macOS / Linux / Terminal:
Alternatively, launch the server using Node.js directly from your terminal:
```bash
node server.js
```

### 4. Access the Application
Once the terminal indicates the server is active, open your preferred web browser and navigate to:
*   **Local Host:** `http://localhost:3000` (or the specific port configured in your `server.js`)
*   **LAN Access:** Use your local machine's IP address (e.g., `http://192.168.1.X:3000`) to let other devices on your Wi-Fi/network join the chat.

---

## 📁 Repository Structure

```text
├── public/             # Frontend assets (HTML, CSS, Client JS)
├── .gitignore          # Prevents tracking of node_modules and system files
├── LICENSE             # MIT License details
├── package.json        # Project metadata and dependency manifest
├── package-lock.json   # Locked dependency tree
├── run.bat             # Automation script for quick Windows startup
└── server.js           # Core Node.js backend server logic
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
