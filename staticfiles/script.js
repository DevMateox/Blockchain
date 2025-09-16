document.addEventListener("DOMContentLoaded", function () {
  
  // Funciones para arrastrar y soltar archivos
  const fileInput = document.getElementById("fileInput");
  const uploadZone = document.getElementById("uploadZone");

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });
  uploadZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", function () {
    if (this.files.length > 0) {
      handleFileSelect(this.files[0]);
    }
  });

  // ========== EFECTO CARGA EN BOTONES ==========
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      if (!this.disabled) {
        this.classList.add("loading");
        setTimeout(() => {
          this.classList.remove("loading");
        }, 1000);
      }
    });
  });

  // ========== SCROLL SUAVE ==========
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      // Si es externo, tiene target="_blank" o es el enlace verify-txhash, no hacer nada
      if (
       /*  this.id === "verify-txhash" || */
        this.target === "_blank" ||
        href.startsWith("http")
      )
        return;

      // Si es solo "#", no hacer nada
      if (href === "#" || href.length <= 1) return;

      e.preventDefault();
      const sectionId = href.substring(1);
      showSection(sectionId);
    });
  });

  // ========== HOVER TARJETAS ==========
  document.querySelectorAll(".info-card, .result-card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-5px)";
      this.style.transition = "transform 0.3s ease";
    });
    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });

  /* Botón para certificar archivos */
  const certifyBtn = document.getElementById("certifyBtn");
  if (certifyBtn) {
    certifyBtn.addEventListener("click", function (e) {
      if (fileInput.files.length === 0) {
        e.preventDefault();
        return;
      }
    });
  }
});

// ========== SUBIDA Y CERTIFICACIÓN ==========
const uploadForm = document.getElementById("uploadForm");
if (uploadForm) {
  uploadForm.addEventListener("submit", function (e) {
    e.preventDefault();

    showBlockchainLoading(); // Mostrar animación de carga

    const formData = new FormData(uploadForm);

    fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        hideBlockchainLoading(); // Ocultar animación de carga

        if (data.success) {
          showBlockchainSuccess(); // Mostrar modal de éxito

          // Limpiar preview
          const fileInputEl = document.getElementById("fileInput");
          const filePreviewEl = document.getElementById("filePreview");
          const fileNameEl = document.getElementById("fileName");
          const fileSizeEl = document.getElementById("fileSize");
          if (fileInputEl) fileInputEl.value = "";
          if (filePreviewEl) filePreviewEl.style.display = "none";
          if (fileNameEl) fileNameEl.textContent = "";
          if (fileSizeEl) fileSizeEl.textContent = "";

          // Inyectar resultado en la página
          const resultContainer = document.getElementById(
            "certificationResult"
          );
          if (resultContainer) {
            resultContainer.innerHTML = `
              <div class="certification-result">
                <div class="result-card certified">
                  <div class="result-icon"><i class="fas fa-certificate"></i></div>
                  <h3>Documento certificado</h3>
                  <div class="result-details">
                    <div class="detail-row">
                      <span>Nombre del archivo:</span>
                      <span>${data.file_name}</span>
                    </div>
                    <div class="detail-row">
                      <span>Hash SHA-256:</span>
                      <code>${data.file_hash}</code>
                    </div>
                    <div class="detail-row">
                      <span>Hash de transacción:</span>
                      <a href="https://sepolia.etherscan.io/tx/${
                        data.tx_hash
                      }" target="_blank">
                        ${data.tx_hash.slice(0, 10)}...${data.tx_hash.slice(-6)}
                      </a>
                    </div>
                    <div class="detail-row">
                      <span>Fecha y hora:</span>
                      <span>${data.fecha_subida}</span>
                    </div>
                  </div>
                  <button class="btn btn-primary" onclick="showCertificateModal(
                    '${data.file_name}',
                    '${data.file_hash}',
                    '${data.fecha_subida}',
                    '${data.direccion_wallet}',
                    '${data.tx_hash}'
                  )">
                    <i class="fas fa-certificate"></i> Ver certificado digital
                  </button>
                </div>
              </div>
            `;
          }
        } else {
          alert("Error: " + (data.error || "falló la certificación"));
        }
      })
      .catch((error) => {
        hideBlockchainLoading();
        console.error("Error en la solicitud:", error);
      });
  });
}

// ========== DESCARGAR CERTIFICADO PDF ==========
const downloadBtn = document.getElementById("downloadCertBtn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", async function () {
    const element = document.querySelector(".certificate");

    const options = {
      margin: 5,
      filename: "certificado-blockchain.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        logging: true,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    const originalText = this.innerHTML;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
    this.disabled = true;

    try {
      await html2pdf().set(options).from(element).save();
      console.log("PDF generado correctamente");
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("Hubo un error al generar el PDF. Por favor, inténtalo de nuevo.");
    } finally {
      this.innerHTML = originalText;
      this.disabled = false;
    }
  });
}

// ========== FUNCIONES AUXILIARES ==========
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

function handleFileSelect(file) {
  const fileNameEl = document.getElementById("fileName");
  const fileSizeEl = document.getElementById("fileSize");
  const filePreviewEl = document.getElementById("filePreview");
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = formatFileSize(file.size);
  if (filePreviewEl) filePreviewEl.style.display = "block";
}

function showSection(sectionId) {
  const sections = document.querySelectorAll(".section, .hero");
  sections.forEach((section) => section.classList.remove("active"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
  }

  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => link.classList.remove("active"));
  const activeLink = document.querySelector(`[href="#${sectionId}"]`);
  if (activeLink) activeLink.classList.add("active");

  window.location.hash = sectionId;
}

function showCertificateModal(filename, fileHash, date, walletAddress, txHash) {
  document.getElementById("cert-filename").textContent = filename;
  document.getElementById("cert-filehash").textContent = fileHash;
  document.getElementById("cert-fecha").textContent = date;
  document.getElementById("cert-wallet").textContent = walletAddress;

  const txLink = document.getElementById("cert-txhash");
  txLink.textContent = txHash;
  txLink.href = `https://sepolia.etherscan.io/tx/${txHash}`;

  document.getElementById("certificateModal").classList.add("active");
}

function closeModal() {
  document.getElementById("certificateModal").classList.remove("active");
}

function showBlockchainLoading() {
  document.getElementById("blockchainLoadingModal").classList.add("active");
  animateBlockchainNodes(0);
}

function hideBlockchainLoading() {
  document.getElementById("blockchainLoadingModal").classList.remove("active");
}

function showBlockchainSuccess() {
  document.getElementById("blockchainSuccessModal").classList.add("active");
}

function closeBlockchainSuccessModal() {
  document.getElementById("blockchainSuccessModal").classList.remove("active");
}

function animateBlockchainNodes(round, onComplete) {
  const nodes = document.querySelectorAll(".blockchain-node-icon");
  nodes.forEach((node) => node.classList.remove("visible"));

  nodes.forEach((node, index) => {
    setTimeout(() => {
      node.classList.add("visible");

      if (index === nodes.length - 1) {
        setTimeout(() => {
          if (round < 1) {
            animateBlockchainNodes(round + 1, onComplete);
          } else {
            if (onComplete) onComplete();
          }
        }, 800);
      }
    }, index * 600);
  });
}


// ========== VERIFICAR DOCUMENTO ==========
const verifyForm = document.getElementById("verifyForm");
const verifyLoadingModal = document.getElementById("verifyLoadingModal");
const verifyModal = document.getElementById("verifyModal");

function showVerifyLoading() {
  if (verifyLoadingModal) verifyLoadingModal.classList.add("active");
}
function hideVerifyLoading() {
  if (verifyLoadingModal) verifyLoadingModal.classList.remove("active");
}
function closeVerifyModal() {
  if (verifyModal) verifyModal.classList.remove("active");
}

if (verifyForm) {
  verifyForm.addEventListener("submit", function (e) {
    e.preventDefault();

    // Cerrar modal resultado si estaba abierto de antes
    closeVerifyModal();

    // Mostrar modal "verificando..."
    showVerifyLoading();

    const formData = new FormData(verifyForm);

    fetch(verifyUrl, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        hideVerifyLoading(); // terminó backend

        // Documento NO certificado en nuestra BD
        if (!data.success && data.not_certified) {
          alert(
            "Lo sentimos, el documento no se encuentra certificado. Certifícalo e intenta nuevamente."
          );
          showSection("upload");
          return;
        }

        // Otro error
        if (!data.success) {
          alert(data.error || "No se pudo verificar el documento.");
          return;
        }

        // Éxito: llenar modal resultado
        const statusEl = document.getElementById("verify-status");
        if (statusEl) {
          statusEl.textContent = data.verified
            ? "✅ Documento verificado correctamente"
            : "";
        }

        const fileHashEl = document.getElementById("verify-filehash");
        if (fileHashEl) fileHashEl.textContent = data.file_hash || "-";

        const bcHashEl = document.getElementById("verify-blockchainhash");
        if (bcHashEl) bcHashEl.textContent = data.blockchain_hash || "-";

        const dateEl = document.getElementById("verify-date");
        if (dateEl) dateEl.textContent = data.fecha_certificacion || "-";

        const txEl = document.getElementById("verify-txhash");
        if (txEl) {
          if (data.tx_hash) {
            const url = "https://sepolia.etherscan.io/tx/" + data.tx_hash;
            console.log("TX URL:", url);
            txEl.setAttribute("href", url);
            txEl.setAttribute("target", "_blank");
            txEl.setAttribute("rel", "noopener noreferrer");
            txEl.textContent =
              data.tx_hash.slice(0, 10) + "..." + data.tx_hash.slice(-6);
          } else {
            txEl.textContent = "-";
            txEl.setAttribute("href", "#");
            txEl.removeAttribute("target");
          }
        }

        // Mostrar resultado
        if (verifyModal) verifyModal.classList.add("active");

        verifyForm.reset();
        const verifyPreview = document.getElementById("verifyPreview");
        if (verifyPreview) verifyPreview.style.display = "none";
      })
      .catch((err) => {
        hideVerifyLoading();
        console.error("Error en la verificación:", err);
        alert("Error al verificar el documento.");
      });
  });
}

const verifyFileInput = document.getElementById("verifyFileInput");

if (verifyFileInput) {
  verifyFileInput.addEventListener("change", function () {
    if (this.files.length > 0) {
      const file = this.files[0];
      showVerifyFilePreview(file);
    }
  });
}

function showVerifyFilePreview(file) {
  const nameEl = document.getElementById("verifyFileName");
  const sizeEl = document.getElementById("verifyFileSize");
  const previewEl = document.getElementById("verifyPreview");

  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
  if (previewEl) previewEl.style.display = "block";
}
