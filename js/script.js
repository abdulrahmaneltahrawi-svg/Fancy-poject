// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    fetch('components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('لم يتم العثور على ملف الهيدر');
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الهيدر:', error);
        });
}

// تنفيذ الوظيفة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', loadHeader);


// وظيفه جلب الارجل
function loadFooter() {
    fetch('components/footer.html')
        .then(res => res.text())
        .then(data => {
            document.getElementById('footer-placeholder').innerHTML = data;
        });
}
loadFooter();





// نستخدم هذا الكود لضمان العمل حتى لو تم تحميل الهيدر بـ fetch
document.addEventListener('click', function (e) {
    const toggle = document.getElementById('dropdown-toggle');
    const menu = document.querySelector('.dropdown-menu');
    const selectedText = document.getElementById('selected-text');

    // 1. إذا ضغط المستخدم على زر القائمة
    if (toggle.contains(e.target)) {
        menu.classList.toggle('show');
        toggle.classList.toggle('active');
    } 
    // 2. إذا ضغط المستخدم على عنصر داخل القائمة
    else if (menu.contains(e.target) && e.target.tagName === 'LI') {
        selectedText.innerText = e.target.innerText;
        menu.classList.remove('show');
        toggle.classList.remove('active');
    }
    // 3. إذا ضغط المستخدم في أي مكان خارج القائمة
    else {
        menu.classList.remove('show');
        toggle.classList.remove('active');
    }
});