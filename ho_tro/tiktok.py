import tkinter as tk
from tkinter import ttk, messagebox, Menu
import subprocess
import threading
import time
import os
import re
import webbrowser
import ctypes

# Ẩn hoàn toàn cửa sổ đen CMD (Console) trên Windows khi mở file .py
if os.name == 'nt':
    ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)

PACKAGE_PATH = "/data/data/com.ss.android.ugc.trill/shared_prefs/aweme_user.xml"

def run_cmd(cmd):
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0
    return subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW, startupinfo=startupinfo)

def check_devices():
    devices = []
    try:
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 0
        out = subprocess.check_output("adb devices", shell=True, creationflags=subprocess.CREATE_NO_WINDOW, startupinfo=startupinfo).decode()
        for line in out.strip().split('\n')[1:]:
            parts = line.split()
            if len(parts) == 2:
                devices.append((parts[0], parts[1]))
    except:
        pass
    return devices

def extract_session(local_save):
    if not os.path.exists(local_save):
        return None
    try:
        with open(local_save, "r", encoding="utf-8", errors="ignore") as f:
            data = f.read()
        patterns = [
            r'&quot;session_id&quot;:&quot;(.*?)&quot;',
            r'&quot;session_key&quot;:&quot;(.*?)&quot;',
            r'"session_id":"(.*?)"',
            r'"sessionid":"(.*?)"',
            r'session_id=(.*?)[";]',
            r'sessionid=(.*?)[";]',
            r'<string name="session_id">(.*?)</string>',
            r'<string name="sessionid">(.*?)</string>',
            r'<string name="session_key">(.*?)</string>',
            r'<string name="session_ss">(.*?)</string>'
        ]
        for p in patterns:
            match = re.search(p, data)
            if match:
                return match.group(1)
    except:
        pass
    return None

class App:
    def __init__(self, root):
        self.root = root
        self.root.title("TikTok Session Manager PRO")
        self.root.geometry("1100x600")
        
        # --- TÙY CHỈNH GIAO DIỆN HIỆN ĐẠI (MODERN FLAT LIGHT) ---
        style = ttk.Style()
        style.theme_use('clam')
        
        # Bảng màu
        bg_main = "#f4f6f9"
        btn_bg = "#e9ecef"
        btn_hover = "#dee2e6"
        text_color = "#343a40"
        
        self.root.configure(bg=bg_main)
        style.configure(".", background=bg_main, foreground=text_color)
        
        # Nút bấm (Button)
        style.configure("TButton", font=("Segoe UI", 9, "bold"), padding=6, relief="flat", background=btn_bg, borderwidth=0)
        style.map("TButton", background=[('active', btn_hover)])
        
        # Bảng (Treeview)
        style.configure("Treeview", 
                        rowheight=35, 
                        font=("Segoe UI", 10),
                        background="#ffffff",
                        fieldbackground="#ffffff",
                        borderwidth=0)
        style.map("Treeview", background=[('selected', '#e3f2fd')], foreground=[('selected', '#000')])
        
        style.configure("Treeview.Heading", 
                        font=("Segoe UI", 10, "bold"), 
                        background="#ffffff", 
                        foreground="#495057",
                        relief="flat",
                        padding=8)
        
        # ---------------- TOP TOOLBAR ----------------
        toolbar = tk.Frame(root, bg="#ffffff", bd=0, padx=10, pady=8)
        toolbar.pack(side=tk.TOP, fill=tk.X)
        
        self.btn_load = ttk.Button(toolbar, text="🔄 Tải Lại Danh Sách (Refresh)", command=self.load_devices)
        self.btn_load.pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=2)
        
        self.btn_run_sel = ttk.Button(toolbar, text="▶ Lấy Session (Tất cả máy chọn)", command=self.run_selected)
        self.btn_run_sel.pack(side=tk.LEFT, padx=2)
        
        self.btn_run_all = ttk.Button(toolbar, text="⏩ Lấy Session (Toàn bộ List)", command=self.run_all)
        self.btn_run_all.pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=2)

        # Các nút thao tác phần cứng
        self.btn_reboot_rec = ttk.Button(toolbar, text="🔧 Reboot Recovery", command=lambda: self.manual_action('recovery'))
        self.btn_reboot_rec.pack(side=tk.LEFT, padx=2)
        
        self.btn_reboot_sys = ttk.Button(toolbar, text="🔌 Reboot OS (Bình thường)", command=lambda: self.manual_action('reboot'))
        self.btn_reboot_sys.pack(side=tk.LEFT, padx=2)

        # Web link click to open
        self.web_link = tk.Label(toolbar, text="🌐 datdon.otistx.com", cursor="hand2", fg="#0056b3", bg="#ffffff", font=("Segoe UI", 10, "bold", "underline"))
        self.web_link.pack(side=tk.RIGHT, padx=10)
        self.web_link.bind("<Button-1>", lambda e: webbrowser.open("https://datdon.otistx.com"))

        # Khung phân cách mỏng
        tk.Frame(root, height=1, bg="#dee2e6").pack(fill=tk.X)

        # ---------------- MAIN DATA GRID ----------------
        main_frame = tk.Frame(root, bg=bg_main, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        columns = ("stt", "serial", "state", "session", "status")
        self.tree = ttk.Treeview(main_frame, columns=columns, show="headings", selectmode="extended")
        
        self.tree.heading("stt", text="STT")
        self.tree.heading("serial", text="Serial ID (ADB)")
        self.tree.heading("state", text="Trạng thái")
        self.tree.heading("session", text="Session TikTok")
        self.tree.heading("status", text="Log Tiến trình")
        
        self.tree.column("stt", width=50, anchor=tk.CENTER)
        self.tree.column("serial", width=150, anchor=tk.CENTER)
        self.tree.column("state", width=100, anchor=tk.CENTER)
        self.tree.column("session", width=250, anchor=tk.W)
        self.tree.column("status", width=400, anchor=tk.W)
        
        # Zebra striping (Hàng chẵn lẻ xen kẽ)
        self.tree.tag_configure('even', background='#f8f9fa')
        self.tree.tag_configure('odd', background='#ffffff')
        
        scroll_y = ttk.Scrollbar(main_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scroll_y.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # ---------------- CONTEXT MENU (Chuột phải) ----------------
        self.popup_menu = Menu(self.root, tearoff=0, font=("Segoe UI", 9))
        self.popup_menu.add_command(label="▶ Tiến hành Lấy Session", command=self.run_selected)
        self.popup_menu.add_separator()
        self.popup_menu.add_command(label="🔧 Khởi động vào Recovery", command=lambda: self.manual_action('recovery'))
        self.popup_menu.add_command(label="🔌 Khởi động lại hệ điều hành", command=lambda: self.manual_action('reboot'))
        self.popup_menu.add_separator()
        self.popup_menu.add_command(label="📋 Copy mã Session", command=self.copy_session)

        self.tree.bind("<Button-3>", self.show_popup)
        self.tree.bind("<ButtonRelease-1>", self.on_click_copy)
        
        # ---------------- STATUS BAR ----------------
        self.status_bar = ttk.Label(root, text=" Sẵn sàng", relief=tk.SUNKEN, anchor=tk.W, font=("Segoe UI", 9))
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.load_devices()

    def show_popup(self, event):
        # Lấy dòng được click
        iid = self.tree.identify_row(event.y)
        if iid:
            # Tự động bôi đen dòng đó nếu chưa được chọn
            if iid not in self.tree.selection():
                self.tree.selection_set(iid)
            self.popup_menu.tk_popup(event.x_root, event.y_root)

    def on_click_copy(self, event):
        region = self.tree.identify_region(event.x, event.y)
        if region == "cell":
            col_id = self.tree.identify_column(event.x)
            row_id = self.tree.identify_row(event.y)
            try:
                col_idx = int(col_id.replace('#', '')) - 1
                values = self.tree.item(row_id, "values")
                if 0 <= col_idx < len(values):
                    cell_value = str(values[col_idx])
                    if cell_value and cell_value.strip() != "" and cell_value != "Đang chờ lệnh...":
                        self.root.clipboard_clear()
                        self.root.clipboard_append(cell_value)
                        self.status_bar.config(text=f" Đã tự động copy: {cell_value}")
            except Exception:
                pass


    def load_devices(self):
        self.status_bar.config(text=" Đang quét thiết bị ADB... Xin chờ")
        
        def _task():
            devices = check_devices()
            def _update_ui():
                for item in self.tree.get_children():
                    self.tree.delete(item)
                
                self.status_bar.config(text=f" Sẵn sàng | Đang kết nối: {len(devices)} thiết bị")
                
                for idx, (dev_id, state) in enumerate(devices):
                    tags = ('even',) if idx % 2 == 0 else ('odd',)
                    self.tree.insert("", tk.END, iid=dev_id, values=(idx + 1, dev_id, state, "", "Đang chờ lệnh..."), tags=tags)
            
            # Đẩy việc cập nhật UI về lại Luồng chính (Main Thread)
            self.root.after(0, _update_ui)
            
        # Chạy check ADB ở luồng phụ để không bị đơ UI
        threading.Thread(target=_task, daemon=True).start()

    def update_cell(self, dev_id, col_index, value):
        # BẮT BUỘC dùng root.after để cập nhật UI từ Thread phụ nhằm chống lag/crash giao diện
        def _update():
            try:
                current_vals = list(self.tree.item(dev_id, "values"))
                current_vals[col_index] = value
                self.tree.item(dev_id, values=current_vals)
            except tk.TclError:
                pass
        self.root.after(0, _update)

    def copy_session(self):
        selected = self.tree.selection()
        if not selected:
            return
        
        sessions = []
        for dev_id in selected:
            vals = self.tree.item(dev_id, "values")
            if vals[3] and vals[3] != "":
                sessions.append(vals[3])
                
        if sessions:
            text_to_copy = "\n".join(sessions)
            self.root.clipboard_clear()
            self.root.clipboard_append(text_to_copy)
            messagebox.showinfo("Copy", f"Đã copy {len(sessions)} Session ID vào bộ nhớ tạm!")
        else:
            messagebox.showwarning("Copy", "Chưa có Session nào để copy!")

    def manual_action(self, action_type):
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn ít nhất 1 thiết bị!")
            return
            
        for dev_id in selected:
            if action_type == 'recovery':
                self.update_cell(dev_id, 4, "[Manual] Đang ra lệnh vào Recovery...")
                threading.Thread(target=run_cmd, args=(f"adb -s {dev_id} reboot recovery",), daemon=True).start()
            elif action_type == 'reboot':
                self.update_cell(dev_id, 4, "[Manual] Đang khởi động lại máy...")
                threading.Thread(target=run_cmd, args=(f"adb -s {dev_id} reboot",), daemon=True).start()

    def run_selected(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn ít nhất 1 thiết bị!")
            return
        for dev_id in selected:
            threading.Thread(target=self.process_device, args=(dev_id,), daemon=True).start()

    def run_all(self):
        for dev_id in self.tree.get_children():
            threading.Thread(target=self.process_device, args=(dev_id,), daemon=True).start()

    def process_device(self, tree_iid):
        adb_id = self.tree.item(tree_iid, "values")[1] # Lấy ID từ cột 1
        
        self.update_cell(tree_iid, 4, "Đang kiểm tra kết nối...")
        devs = check_devices()
        state = next((s for d, s in devs if d == adb_id), None)
        
        if not state:
            self.update_cell(tree_iid, 2, "offline")
            self.update_cell(tree_iid, 4, "Lỗi: Mất kết nối ADB!")
            return
            
        self.update_cell(tree_iid, 2, state)

        if state == 'device':
            old_devs_ids = [d for d, s in devs]
            self.update_cell(tree_iid, 4, "Đang khởi động lại vào TWRP...")
            run_cmd(f"adb -s {adb_id} reboot recovery")
            self.update_cell(tree_iid, 2, "rebooting...")
            
            twrp_ready = False
            new_adb_id = adb_id
            for _ in range(35):
                time.sleep(2)
                cur_devs = check_devices()
                
                if any(d == adb_id and s == 'recovery' for d, s in cur_devs):
                    twrp_ready = True
                    break
                
                new_recovs = [d for d, s in cur_devs if s == 'recovery' and d not in old_devs_ids]
                if new_recovs:
                    new_adb_id = new_recovs[0]
                    twrp_ready = True
                    break
                    
            if not twrp_ready:
                self.update_cell(tree_iid, 4, "Lỗi: Không vào được TWRP (Timeout)")
                return
                
            adb_id = new_adb_id
            self.update_cell(tree_iid, 1, adb_id)
            self.update_cell(tree_iid, 2, "recovery")
            time.sleep(2)

        elif state == 'recovery':
            self.update_cell(tree_iid, 4, "Thiết bị đã ở sẵn Recovery.")
        else:
            self.update_cell(tree_iid, 4, f"Trạng thái không hỗ trợ: {state}")
            return

        # Mount Data
        self.update_cell(tree_iid, 4, "Đang Mount phân vùng bảo mật (/data)...")
        run_cmd(f"adb -s {adb_id} shell twrp mount data")
        time.sleep(2)

        # Pull
        local_save = f"aweme_user_{adb_id}.xml"
        self.update_cell(tree_iid, 4, "Đang trích xuất file cấu hình...")
        
        success = False
        for _ in range(3):
            res = run_cmd(f"adb -s {adb_id} pull {PACKAGE_PATH} {local_save}")
            if res.returncode == 0 and os.path.exists(local_save) and os.path.getsize(local_save) > 50:
                success = True
                break
            time.sleep(1)

        if not success:
            self.update_cell(tree_iid, 4, "Lỗi: Chưa mount được Data hoặc App chưa cài!")
            return

        # Extract
        self.update_cell(tree_iid, 4, "Đang giải mã dữ liệu...")
        session = extract_session(local_save)
        
        if session:
            self.update_cell(tree_iid, 3, session)
            self.update_cell(tree_iid, 4, "Hoàn tất! Đang khởi động lại máy...")
            run_cmd(f"adb -s {adb_id} reboot")
            self.update_cell(tree_iid, 2, "rebooting...")
        else:
            self.update_cell(tree_iid, 4, "Thất bại: Ứng dụng chưa đăng nhập!")
            
        try:
            if os.path.exists(local_save):
                os.remove(local_save)
        except:
            pass

if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
