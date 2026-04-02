const Special = {
    init() {
        const btnSave = document.getElementById("btn-save-special");
        if (btnSave) {
            btnSave.onclick = () => this.saveSpecial();
        }
        console.log("Special section ready.");
    },

    async saveSpecial() {
        const payload = {
            qName: document.getElementById("special-q-name").value.trim(),
            qNote: document.getElementById("special-q-note").value.trim(),
            bName: document.getElementById("special-b-name").value.trim(),
            bNote: document.getElementById("special-b-note").value.trim(),
            eName: document.getElementById("special-e-name").value.trim(),
            eNote: document.getElementById("special-e-note").value.trim(),
            cName: document.getElementById("special-c-name").value.trim(),
            cNote: document.getElementById("special-c-note").value.trim(),
        };

        if (!payload.qName && !payload.bName && !payload.eName && !payload.cName) {
            alert("請至少輸入一位球員姓名才能發布！");
            return;
        }

        const btnSave = document.getElementById("btn-save-special");
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 發布中...';

        try {
            const res = await API.saveSpecialRecords(payload);
            if (res && res.status === "success") {
                alert("太棒了！已成功發布本月特殊紀錄。");
                document.getElementById("special-q-name").value = "";
                document.getElementById("special-q-note").value = "";
                document.getElementById("special-b-name").value = "";
                document.getElementById("special-b-note").value = "";
                document.getElementById("special-e-name").value = "";
                document.getElementById("special-e-note").value = "";
                document.getElementById("special-c-name").value = "";
                document.getElementById("special-c-note").value = "";
            }
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="fas fa-save"></i> 儲存並發布紀錄';
        }
    }
};
