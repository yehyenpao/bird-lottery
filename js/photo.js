const Photo = {
    playerMap: {},
    base64Image: null,

    async loadPlayers() {
        const select = document.getElementById("photo-player-select");
        if (!select) return;

        select.innerHTML = '<option value="">更新名單中...</option>';
        try {
            const res = await API.getPlayersInfo();
            if (res && res.status === "success") {
                this.playerMap = res.data || {};
                
                // 整理選單
                const names = Object.keys(this.playerMap).sort();
                if (names.length === 0) {
                    select.innerHTML = '<option value="">(目前無球員資料，請先匯入報名資料)</option>';
                } else {
                    let html = '<option value="">-- 請選擇球員 --</option>';
                    names.forEach(name => {
                        const hasPhoto = this.playerMap[name] ? " (已上傳)" : "";
                        html += `<option value="${name}">${name}${hasPhoto}</option>`;
                    });
                    select.innerHTML = html;
                }
            } else {
                select.innerHTML = '<option value="">載入失敗</option>';
            }
        } catch (e) {
            console.error("載入球員名單失敗", e);
            select.innerHTML = '<option value="">載入失敗</option>';
        }
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.match('image.*')) {
            alert('請選擇圖片檔案！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 進行圖片壓縮 Canvas
                const canvas = document.getElementById('photo-canvas');
                const ctx = canvas.getContext('2d');
                
                // 設定縮放目標 (最大 500x500)
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // 轉出為品質 0.8 的 JPEG base64
                this.base64Image = canvas.toDataURL('image/jpeg', 0.8);
                
                // 顯示預覽
                const previewCon = document.getElementById('photo-preview-container');
                const previewImg = document.getElementById('photo-preview');
                const uploadBtn = document.getElementById('btn-upload-photo');
                
                previewImg.src = this.base64Image;
                previewCon.style.display = "block";
                
                if (document.getElementById("photo-player-select").value) {
                    uploadBtn.disabled = false;
                    uploadBtn.style.display = "block";
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    async uploadPhoto() {
        const name = document.getElementById("photo-player-select").value;
        if (!name || !this.base64Image) {
            alert("請先選擇球員並挑選照片！");
            return;
        }

        const btn = document.getElementById('btn-upload-photo');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上傳處理中...';
        btn.disabled = true;

        try {
            const data = {
                name: name,
                base64Data: this.base64Image,
                mimeType: "image/jpeg"
            };
            
            const res = await API.uploadPhoto(data);
            if (res && res.status === "success") {
                alert(`上傳成功！照片已自動連接至球員：${name}`);
                // 刷新選單狀態
                this.loadPlayers();
                
                // 重置狀態
                document.getElementById('photo-preview-container').style.display = "none";
                document.getElementById('photo-input').value = "";
                this.base64Image = null;
                btn.style.display = "none";
            }
        } catch (e) {
            console.error("上傳失敗", e);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    init() {
        const photoInput = document.getElementById('photo-input');
        const uploadBtn = document.getElementById('btn-upload-photo');
        const select = document.getElementById("photo-player-select");
        
        if (photoInput) {
            photoInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadPhoto());
        }
        if (select) {
            select.addEventListener('change', () => {
                if (select.value && this.base64Image) {
                    uploadBtn.disabled = false;
                    uploadBtn.style.display = "block";
                } else {
                    uploadBtn.disabled = true;
                }
            });
        }
    }
};
