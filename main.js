const scriptURL = "https://script.google.com/macros/s/AKfycby3LSG3YFFEDtFErlfIzWIp0PPqGHewAxfwgQqzMLhLFtwm219MpM4Uh9L8lUhehInm-g/exec";

let currentStream = null;
let currentFacing = 'environment';  // 'environment' ou 'user'
let lastImageURL = null;

$(document).ready(function() {
  $('#uploadBtn').click(() => $('#fileInput').click());

  $('#fileInput').on('change', function() {
    const file = this.files[0];
    if (file) sendFile(file, false);
    $(this).val('');
  });

  $('#cameraBtn').click(openCamera);
  $('#switchCameraBtn').click(() => {
    // alterna e reabre a câmera
    currentFacing = (currentFacing === 'environment') ? 'user' : 'environment';
    openCamera();
  });
  $('#takePhotoBtn').click(capturePhoto);
  $('#closeCameraBtn').click(closeCamera);
  $('#closePreviewBtn').click(closePreview);
});

// mostra/oculta loader
function showLoader() { $('#loader').css('display','flex'); }
function hideLoader() { $('#loader').css('display','none'); }

// abre a câmera
function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toastr.error('Seu navegador não suporta câmera');
    return;
  }
  // fecha stream anterior, se houver
  closeCamera();

  const constraints = {
    video: {
      facingMode: currentFacing,
      width:  { ideal: 1280 },
      height: { ideal:  720 }
    }
  };

  showLoader();
  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      hideLoader();
      currentStream = stream;
      $('#video')[0].srcObject = stream;
      setupZoomSlider(stream);
      $('#cameraModal').addClass('active');
    })
    .catch(err => {
      hideLoader();
      console.error('Erro ao abrir câmera:', err);
      toastr.error('Não foi possível acessar a câmera');
    });
}

// captura foto sem perda (PNG)
function capturePhoto() {
  if (!currentStream) return;
  const video = $('#video')[0];
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  canvas.toBlob(blob => {
    const imageFile = new File([blob], 'foto_casamento.png', { type: 'image/png' });
    sendFile(imageFile, true);
  }, 'image/png');
  closeCamera();
}

// fecha modal e stream
function closeCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t=>t.stop());
    currentStream = null;
  }
  $('#cameraModal').removeClass('active');
  $('#video')[0].srcObject = null;
}

// preenche o slider de zoom, se suportado
function setupZoomSlider(stream) {
  const track = stream.getVideoTracks()[0];
  const cap   = track.getCapabilities();
  if (cap.zoom) {
    $('#zoomSlider').attr({
      min: cap.zoom.min,
      max: cap.zoom.max,
      step: cap.zoom.step,
      value: cap.zoom.min
    }).show().off('input').on('input', function(){
      track.applyConstraints({ advanced:[{ zoom: Number(this.value) }] });
    });
  } else {
    $('#zoomSlider').hide();
  }
}

// envia imagem ou vídeo (base64)
function sendFile(file, fromCamera) {
  if (file.size > 50 * 1024 * 1024) {
    toastr.error('Arquivo muito grande. Máx 50MB.');
    return;
  }

  showLoader();
  const reader = new FileReader();
  reader.onload = ev => {
    const base64 = ev.target.result.split(',')[1];
    $.ajax({
      url:    scriptURL,
      method: 'POST',
      data:   {
        filename: file.name,
        mimeType: file.type,
        file:     base64
      },
      success: res => {
        hideLoader();
        toastr.success(fromCamera
          ? 'Foto enviada com sucesso!'
          : file.type.startsWith('image/')
            ? 'Upload de imagem OK!'
            : 'Upload de vídeo OK!');
        if (fromCamera) showPreview(file);
      },
      error: err => {
        hideLoader();
        console.error('Erro no upload:', err);
        toastr.error('Erro ao enviar. Tente novamente.');
      }
    });
  };
  reader.readAsDataURL(file);
}

// mostra preview e link de download (só para foto de câmera)
function showPreview(file) {
  lastImageURL && URL.revokeObjectURL(lastImageURL);
  lastImageURL = URL.createObjectURL(file);
  $('#previewImage').attr('src', lastImageURL);
  $('#downloadPhotoBtn')
    .attr('href', lastImageURL)
    .attr('download', file.name);
  $('#previewModal').addClass('active');
}

function closePreview() {
  $('#previewModal').removeClass('active');
  lastImageURL && URL.revokeObjectURL(lastImageURL);
  lastImageURL = null;
}
