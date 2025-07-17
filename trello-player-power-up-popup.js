const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');
let attachmentsList = document.getElementById('attachments-list');
let waveformView = document.getElementById('waveform-view');
let waveformTemplate = document.getElementById('waveform-template');
let attachmentTemplate = document.getElementById('attachment-template');
let modal = document.getElementById('waveform-modal');
let downloadLink = document.getElementById('download-file');
let loadFileLink = document.getElementById('load-file');
let fileInput = document.getElementById('waveform-file-input');
let saveBtn = document.getElementById('save-waveform');
let cancelBtn = document.getElementById('cancel-waveform');
let waveformPreview = document.getElementById('waveform-preview');
let deleteWaveform = false;
let deleteBtn;
class WaveformPreview extends HTMLElement {
  constructor() {
    super();
  }
  createPlayer() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.innerHTML = '';
    }
    const container = document.createElement('div');
    container.className = 'waveform-canvas';
    this.appendChild(container);
    this.wavesurfer = WaveSurfer.create({container, height:80});
    return this.wavesurfer;
  }
  loadFromData(peaks, duration) {
    const ws = this.createPlayer();
    ws.load('', peaks, duration);
  }
  async loadFromUrl(url) {
    const ws = this.createPlayer();
    return new Promise((resolve) => {
      ws.once('ready', resolve);
      ws.load(url);
    });
  }
  clear() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    this.innerHTML = '';
  }
  exportPeaks() {
    return this.wavesurfer.exportPeaks({channels:1,maxLength:600,precision:1000});
  }
  getDuration() {
    return this.wavesurfer.getDuration();
  }
}
customElements.define('waveform-preview', WaveformPreview);
let currentAttachment;
let waveformDuration;

async function loadPlayer() {
  try {
    m4aAttachments = [];
    const listInfo = await t.list('cards');
    const cards = listInfo.cards;
    cards.forEach(card => {
      const cardM4aAttachments = card.attachments.filter(attachment => attachment.url.endsWith('.m4a') || attachment.url.endsWith('.mp3'));
      cardM4aAttachments.forEach(attachment => {
        m4aAttachments.push(Object.assign({cardId: card.id}, attachment));

        const li = attachmentTemplate.content.firstElementChild.cloneNode(true);
        li.querySelector('.attachment-name').textContent = attachment.name;
        li.addEventListener('click', () => {
          loadAttachment(m4aAttachments.findIndex((att) => att.id == attachment.id));
        });
        attachmentsList.appendChild(li);
      });
    });

    if (m4aAttachments.length > 0) {
      loadAttachment(0);
    }
  }
  catch (error) {
    console.error('Error fetching attachments:', error);
    alert('Failed to load attachments. Please try again.');
  }
}

function loadAttachment(index) {
  if (index >= 0 && index < m4aAttachments.length) {
    currentAttachmentIndex = index;
    audioPlayer.src = m4aAttachments[index].url;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.then(_ => {}).catch(error => {});
    }

    const attachmentsListItems = document.querySelectorAll('#attachments-list li');
    attachmentsListItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });

    currentAttachment = m4aAttachments[index];
    showWaveform(currentAttachment);
  }
}

document.getElementById('prev-button').addEventListener('click', () => {
  if (currentAttachmentIndex > 0) {
    loadAttachment(currentAttachmentIndex - 1);
  }
});


document.getElementById('next-button').addEventListener('click', () => {
  if (currentAttachmentIndex < m4aAttachments.length - 1) {
    loadAttachment(currentAttachmentIndex + 1);
  }
});

function showWaveform(att) {
  waveformView.innerHTML = '';
  const frag = waveformTemplate.content.cloneNode(true);
  const msg = frag.querySelector('.no-waveform-msg');
  const wrench = frag.querySelector('.wrench');
  const canvas = frag.querySelector('.waveform-canvas');
  wrench.addEventListener('click', () => openWaveformModal(att));

  waveformView.appendChild(frag);

  t.get(att.cardId, 'shared', 'waveformData').then(data => {
    if (data) {
      msg.remove();
      wrench.classList.add('floating');
      const ws = WaveSurfer.create({
        container: canvas,
        interact: true,
        normalize: true,
        height:80,
        media: audioPlayer
      });
      const wfData = JSON.parse(data);
      ws.load('', wfData.peaks, wfData.duration);
    }
  });
}

function openWaveformModal(att) {
  currentAttachment = att;
  downloadLink.href = att.url;
  downloadLink.download = att.name;
  waveformPreview.clear();
  deleteWaveform = false;
  deleteBtn && deleteBtn.remove();
  saveBtn.disabled = true;
  modal.classList.remove('hidden');
  modal.focus();
  t.get(att.cardId, 'shared', 'waveformData').then(data => {
    if (data) {
      const wfData = JSON.parse(data);
      waveformPreview.loadFromData(wfData.peaks, wfData.duration);
      deleteBtn = document.createElement('span');
      deleteBtn.textContent = '🅇';
      deleteBtn.className = 'delete-waveform';
      deleteBtn.addEventListener('click', () => {
        deleteWaveform = true;
        saveBtn.disabled = false;
        waveformPreview.clear();
        deleteBtn.remove();
      });
      waveformPreview.appendChild(deleteBtn);
    }
  });
}

loadFileLink.addEventListener('click', (e) => {
  e.preventDefault();
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  if (fileInput.files.length === 0) return;
  const url = URL.createObjectURL(fileInput.files[0]);
  await waveformPreview.loadFromUrl(url);
  saveBtn.disabled = false;
  deleteWaveform = false;
  deleteBtn && deleteBtn.remove();
  waveformDuration = waveformPreview.getDuration();
});

cancelBtn.addEventListener('click', closeModal);
saveBtn.addEventListener('click', async () => {
  if (deleteWaveform) {
    await t.remove(currentAttachment.cardId, 'shared', 'waveformData');
  } else {
    const peaks = waveformPreview.exportPeaks();
    const waveformData = {peaks, duration: waveformDuration};
    await t.set(currentAttachment.cardId, 'shared', 'waveformData', JSON.stringify(waveformData));
  }
  closeModal();
  showWaveform(currentAttachment);
});

function closeModal() {
  modal.classList.add('hidden');
  waveformPreview.clear();
  fileInput.value = '';
  deleteWaveform = false;
  deleteBtn && deleteBtn.remove();
}

modal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); }
  if (e.key === 'Enter' && !saveBtn.disabled) { saveBtn.click(); }
});

audioPlayer.addEventListener('ended', () => {
  if (currentAttachmentIndex < m4aAttachments.length - 1) {
    loadAttachment(currentAttachmentIndex + 1);
  }
});

window.addEventListener('load', loadPlayer);
