import { InstagramScraper } from '../api/instagramScraper.js';

let isScraping = false;
let shouldCancel = false;
let currentResults = [];

const usernameInput = document.getElementById('target-username');
const typeSelect = document.getElementById('scrape-type');
const maxLimitInput = document.getElementById('max-limit');
const delayInput = document.getElementById('delay-ms');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const progressContainer = document.getElementById('progress-container');
const targetLabel = document.getElementById('target-label');
const countLabel = document.getElementById('count-label');
const progressBar = document.getElementById('progress-bar');
const statusMsg = document.getElementById('status-msg');
const exportContainer = document.getElementById('export-container');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportJsonBtn = document.getElementById('export-json-btn');

startBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  if (!username) {
    alert('Please enter an Instagram username.');
    return;
  }

  const type = typeSelect.value;
  const rawMax = parseInt(maxLimitInput.value, 10);
  const maxLimit = isNaN(rawMax) || rawMax <= 0 ? Infinity : rawMax;
  const baseDelay = parseInt(delayInput.value, 10) || 1500;

  isScraping = true;
  shouldCancel = false;
  currentResults = [];

  startBtn.disabled = true;
  progressContainer.classList.remove('hidden');
  exportContainer.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  progressBar.style.width = '0%';
  targetLabel.innerText = `@${username.replace(/^@/, '')} (${type})`;
  countLabel.innerText = '0 extracted';
  statusMsg.innerText = 'Resolving user profile...';

  const scraper = new InstagramScraper({ baseDelay });

  try {
    const userProfile = await scraper.getUserByUsername(username);
    statusMsg.innerText = `Found ID ${userProfile.id}. Fetching ${type}...`;

    const res = await scraper.scrapeUsers({
      userId: userProfile.id,
      type,
      maxLimit,
      pageSize: 50,
      isCancelled: () => shouldCancel,
      onProgress: (batch, totalCollected, endCursor, hasNextPage) => {
        countLabel.innerText = `${totalCollected} extracted`;
        statusMsg.innerText = hasNextPage 
          ? `Fetching next page... (${totalCollected} total)`
          : `Finished! Collected ${totalCollected} users.`;
        
        if (maxLimit !== Infinity) {
          const pct = Math.min(100, Math.round((totalCollected / maxLimit) * 100));
          progressBar.style.width = `${pct}%`;
        } else {
          progressBar.style.width = '100%';
        }
      }
    });

    currentResults = res.results;
    statusMsg.innerText = shouldCancel 
      ? `Stopped. Collected ${currentResults.length} records.` 
      : `Completed! Scraped ${currentResults.length} records.`;

  } catch (err) {
    statusMsg.innerText = `Error: ${err.message}`;
    console.error(err);
  } finally {
    isScraping = false;
    startBtn.disabled = false;
    stopBtn.classList.add('hidden');
    if (currentResults.length > 0) {
      exportContainer.classList.remove('hidden');
    }
  }
});

stopBtn.addEventListener('click', () => {
  shouldCancel = true;
  stopBtn.disabled = true;
  statusMsg.innerText = 'Stopping scraper...';
});

// CSV Export
exportCsvBtn.addEventListener('click', () => {
  if (!currentResults.length) return;

  const headers = ['User ID', 'Username', 'Full Name', 'Is Private', 'Is Verified', 'Profile Pic URL'];
  const rows = currentResults.map(u => [
    `"${u.id}"`,
    `"${(u.username || '').replace(/"/g, '""')}"`,
    `"${(u.fullName || '').replace(/"/g, '""')}"`,
    u.isPrivate ? 'true' : 'false',
    u.isVerified ? 'true' : 'false',
    `"${u.profilePicUrl || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  downloadBlob(csvContent, `instagram_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
});

// JSON Export
exportJsonBtn.addEventListener('click', () => {
  if (!currentResults.length) return;
  const jsonContent = JSON.stringify(currentResults, null, 2);
  downloadBlob(jsonContent, `instagram_export_${Date.now()}.json`, 'application/json');
});

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
