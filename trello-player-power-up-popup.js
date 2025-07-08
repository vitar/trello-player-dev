const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');
let attachmentsList = document.getElementById('attachments-list');
let waveformView = document.getElementById('waveform-view');
let modal = document.getElementById('waveform-modal');
let downloadLink = document.getElementById('download-file');
let loadFileLink = document.getElementById('load-file');
let fileInput = document.getElementById('waveform-file-input');
let saveBtn = document.getElementById('save-waveform');
let cancelBtn = document.getElementById('cancel-waveform');
let waveformPreview = document.getElementById('waveform-preview');
let wavesurfer;
let currentAttachment;

async function loadPlayer() {
  try {
    m4aAttachments = [];
    const listInfo = await t.list('cards');
    const cards = listInfo.cards;
    cards.forEach(card => {
      const cardM4aAttachments = card.attachments.filter(attachment => attachment.url.endsWith('.m4a') || attachment.url.endsWith('.mp3'));
      cardM4aAttachments.forEach(attachment => {
        m4aAttachments.push(Object.assign({cardId: card.id}, attachment));

        const attachmentLi = document.createElement('li');
        const textSpan = document.createElement('span');
        textSpan.textContent = attachment.name;
        attachmentLi.appendChild(textSpan);
        const wrench = document.createElement('span');
        wrench.textContent = '\uD83D\uDD27';
        wrench.className = 'wrench';
        wrench.addEventListener('click', (e) => {
          e.stopPropagation();
          openWaveformModal(attachment);
        });
        attachmentLi.appendChild(wrench);
        attachmentLi.addEventListener('click', () => {
          loadAttachment(m4aAttachments.findIndex((att) => att.id == attachment.id));
        });
        attachmentsList.appendChild(attachmentLi);
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
  const wrench = document.createElement('span');
  wrench.textContent = '\uD83D\uDD27';
  wrench.className = 'wrench';
  wrench.addEventListener('click', () => openWaveformModal(att));

  t.get(att.cardId, 'shared', 'waveformData').then(data => {
    if (data) {
      const ws = WaveSurfer.create({container: waveformView, interact:false, height:80});
      ws.loadPeaks(JSON.parse(data), att.url);
    } else {
      const msg = document.createElement('span');
      msg.textContent = 'Waveform is unavailable. Create waveform ';
      waveformView.appendChild(msg);
      waveformView.appendChild(wrench);
    }
  });
}

function openWaveformModal(att) {
  currentAttachment = att;
  downloadLink.href = att.url;
  wavesurfer && wavesurfer.destroy();
  waveformPreview.innerHTML = '';
  wavesurfer = WaveSurfer.create({container: waveformPreview, height:80});
  saveBtn.disabled = true;
  modal.classList.remove('hidden');
  modal.focus();
}

loadFileLink.addEventListener('click', (e) => {
  e.preventDefault();
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  if (fileInput.files.length === 0) return;
  const url = URL.createObjectURL(fileInput.files[0]);
  await wavesurfer.load(url);
  wavesurfer.once('ready', () => {
    saveBtn.disabled = false;
  });
});

cancelBtn.addEventListener('click', closeModal);
saveBtn.addEventListener('click', async () => {
  const peaks = wavesurfer.exportPeaks({channels:1,maxLength:600,precision:1000});
  await t.set(currentAttachment.cardId, 'shared', 'waveformData', JSON.stringify(peaks));
  closeModal();
  showWaveform(currentAttachment);
});

function closeModal() {
  modal.classList.add('hidden');
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
