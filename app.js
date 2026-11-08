const $ = id => document.getElementById(id);
const screens = {order:$('orderScreen'),rides:$('ridesScreen'),profile:$('profileScreen')};
function showTab(name){
  Object.entries(screens).forEach(([key,el])=>el.classList.toggle('active',key===name));
  document.querySelectorAll('.tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.go)));
$('orderForm').addEventListener('submit',e=>{
  e.preventDefault();
  const from=$('from').value.trim(),to=$('to').value.trim(),price=$('price').value.trim();
  $('resultText').textContent=`${from} → ${to}. ${$('when').value}, ${$('people').value}.${price?` Ваша цена: ${price} ₽.`:''}`;
  $('resultDialog').showModal();
});
$('dialogOk').addEventListener('click',()=>$('resultDialog').close());
$('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());
$('helpOk').addEventListener('click',()=>$('helpDialog').close());
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
