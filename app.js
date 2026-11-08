const $=id=>document.getElementById(id);
const STORAGE='ttaxi-demo-orders-v1';
let role='passenger', pendingOrderId=null;
const sampleOrders=[
{id:'sample-1',from:'Центр, Татарск',to:'Вокзал, Татарск',when:'Сейчас',people:'1 пассажир',price:'',status:'open',offers:[],created:'Пример заявки'},
{id:'sample-2',from:'Улица Ленина, 10',to:'Больница',when:'Сейчас',people:'2 пассажира',price:'300',status:'open',offers:[],created:'Пример заявки'}
];
function loadOrders(){try{return JSON.parse(localStorage.getItem(STORAGE))||[]}catch{return []}}
function saveOrders(data){localStorage.setItem(STORAGE,JSON.stringify(data))}
function allOrders(){return [...sampleOrders,...loadOrders()]}
function setRole(next){role=next; $('roleSwitch').textContent=`Режим: ${next==='passenger'?'Пассажир':'Водитель'}⌄`; showScreen(next==='driver'?'driverScreen':'passengerScreen'); render()}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));window.scrollTo({top:0,behavior:'smooth'})}
$('roleSwitch').onclick=()=>$('roleDialog').showModal();
document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{$('roleDialog').close();setRole(b.dataset.role)});
$('roleCancel').onclick=()=>$('roleDialog').close();
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
function info(title,text){$('infoTitle').textContent=title;$('infoText').textContent=text;$('infoDialog').showModal()}
$('infoOk').onclick=()=>$('infoDialog').close();
$('orderForm').onsubmit=e=>{
 e.preventDefault();
 const order={id:'o'+Date.now(),from:$('from').value.trim(),to:$('to').value.trim(),when:$('when').value,people:$('people').value,price:$('price').value.trim(),status:'open',offers:[],created:new Date().toLocaleString('ru-RU')};
 const data=loadOrders();data.unshift(order);saveOrders(data);render();
 info('Заявка создана','В тестовом режиме её можно увидеть во вкладке «Водитель». Это не настоящая отправка диспетчеру.');
};
function render(){
 const orders=allOrders();
 const offers=orders.flatMap(o=>(o.offers||[]).map(x=>({...x,order:o}))).filter(x=>x.order.id.startsWith('o'));
 $('offersList').innerHTML=offers.length?offers.map(x=>`<article class="offer-card"><div class="offer-top"><div><div class="driver-name">${esc(x.name)}</div><div class="driver-meta">Предложение по вашей заявке</div></div><div class="offer-price">${esc(x.price)} ₽</div></div><div class="order-detail">${esc(x.order.from)} → ${esc(x.order.to)}</div><div class="offer-actions"><button class="small-button" data-choose="${x.order.id}|${x.id}">Выбрать водителя</button></div></article>`).join(''):'<div class="empty-state">Предложений пока нет. В тестовом режиме они появятся, когда водитель ответит на заявку.</div>';
 $('driverOrders').innerHTML=orders.filter(o=>o.status==='open').map(o=>`<article class="offer-card"><div class="offer-top"><b>Новая заявка</b><span class="demo-tag">ТЕСТ</span></div><div class="order-route">${esc(o.from)} <span style="color:#aaa">→</span> ${esc(o.to)}</div><div class="order-detail">${esc(o.when)} · ${esc(o.people)} ${o.price?`· Цена пассажира: ${esc(o.price)} ₽`:''}</div><div class="offer-actions"><button class="small-button" data-offer="${o.id}">Предложить цену</button></div></article>`).join('')||'<div class="empty-state">Новых заявок пока нет.</div>';
 const mine=orders.filter(o=>o.id.startsWith('o'));
 $('historyList').innerHTML=mine.length?mine.map(o=>`<article class="offer-card"><b>${esc(o.status==='chosen'?'Водитель выбран':'Заявка создана')}</b><div class="order-route">${esc(o.from)} → ${esc(o.to)}</div><div class="order-detail">${esc(o.created)} · ${o.offers.length} предложений</div></article>`).join(''):'<div class="empty-state">Пока заказов нет.</div>';
 document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>openOffer(b.dataset.offer));
 document.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>chooseOffer(b.dataset.choose));
}
function openOffer(id){pendingOrderId=id;const o=allOrders().find(x=>x.id===id);$('offerRoute').textContent=`${o.from} → ${o.to}`;$('driverPrice').value='';$('offerDialog').showModal()}
$('offerCancel').onclick=()=>$('offerDialog').close();
$('sendOffer').onclick=()=>{
 const price=$('driverPrice').value.trim();if(!price||Number(price)<=0){info('Укажите цену','Введите сумму больше нуля.');return}
 const data=loadOrders(),o=data.find(x=>x.id===pendingOrderId);
 if(!o){$('offerDialog').close();info('Это пример','Предложения к демонстрационным заявкам не сохраняются. Создайте свой тестовый заказ в режиме пассажира.');return}
 o.offers=o.offers||[];o.offers.push({id:'f'+Date.now(),name:'Водитель тест',price});saveOrders(data);$('offerDialog').close();render();setRole('passenger');info('Предложение отправлено','Переключились в режим пассажира. Предложение видно на главном экране.');
};
function chooseOffer(key){const [oid,fid]=key.split('|');const data=loadOrders(),o=data.find(x=>x.id===oid);if(!o)return;const f=o.offers.find(x=>x.id===fid);o.status='chosen';o.chosen=f;saveOrders(data);render();info('Водитель выбран',`Тестовый водитель предложил ${f.price} ₽. Реальный заказ пока не создаётся.`)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
render();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
