const fs = require('fs');
const path = require('path');

class LocalFileStore {
    constructor(dataPath) {
        this.dataPath = dataPath; // Must match the dataPath passed to RemoteAuth
        this.backupDir = path.join(dataPath, 'remote_backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async sessionExists({ session }) {
        const backupPath = path.join(this.backupDir, `${session}.zip`);
        return fs.existsSync(backupPath);
    }

    async save({ session }) {
        const sourcePath = path.join(this.dataPath, `${session}.zip`);
        const backupPath = path.join(this.backupDir, `${session}.zip`);
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, backupPath);
            console.log(`📦 RemoteAuth: Session backup saved locally at ${backupPath}`);
        }
    }

    async extract({ session, path: destPath }) {
        const backupPath = path.join(this.backupDir, `${session}.zip`);
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, destPath);
            console.log(`📂 RemoteAuth: Session extracted from ${backupPath}`);
        }
    }

    async delete({ session }) {
        const backupPath = path.join(this.backupDir, `${session}.zip`);
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            console.log(`🗑️ RemoteAuth: Session backup deleted`);
        }
    }
}

module.exports = LocalFileStore;
