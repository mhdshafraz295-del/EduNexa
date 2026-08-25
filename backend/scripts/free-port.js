import { execSync } from 'child_process';
import os from 'os';

const PORT = parseInt(process.env.PORT || '5000', 10);

function getListeningPIDs(port) {
  const pids = new Set();
  const isWindows = os.platform() === 'win32';

  try {
    if (isWindows) {
      // Query TCP connections in LISTENING state
      const output = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = output.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length >= 5) {
          const localAddress = parts[1];
          const state = parts[3];
          const pid = parseInt(parts[4], 10);

          // Check if listening on exact port and state is LISTENING
          const isTargetPort =
            localAddress.endsWith(`:${port}`) ||
            localAddress.endsWith(`]:${port}`);

          if (isTargetPort && state === 'LISTENING' && pid && pid !== 0 && pid !== process.pid) {
            pids.add(pid);
          }
        }
      }
    } else {
      // POSIX fallback (macOS / Linux)
      try {
        const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        output.split('\n').forEach((line) => {
          const pid = parseInt(line.trim(), 10);
          if (pid && pid !== 0 && pid !== process.pid) {
            pids.add(pid);
          }
        });
      } catch (e) {
        // lsof returns exit code 1 if no process found
      }
    }
  } catch (err) {
    // If netstat fails, continue gracefully
  }

  return Array.from(pids);
}

function freePort() {
  const pids = getListeningPIDs(PORT);

  if (pids.length === 0) {
    console.log(`Port ${PORT} is free.`);
    return;
  }

  const isWindows = os.platform() === 'win32';

  for (const pid of pids) {
    console.log(`Stopping stale process PID ${pid} on port ${PORT}...`);
    try {
      if (isWindows) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      }
      console.log(`Port ${PORT} released.`);
    } catch (err) {
      // Process may have already exited
    }
  }
}

freePort();
