/**
 * ========================================================
 * 바이브 카페 (Vibe Cafe) - 주문서 및 주문 내역 자바스크립트
 * ========================================================
 */

// ----------------------------------------------------
// 0. Supabase 접속 설정 (상수)
// 본인의 Supabase 프로젝트 대시보드 (Settings > API)에서 확인한 값을 넣어주세요.
// ----------------------------------------------------
const SUPABASE_URL = "https://vrfhqgszghrbbldokfqr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZmhxZ3N6Z2hyYmJsZG9rZnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTU5MjMsImV4cCI6MjEwNjk3MTkyM30.dtHtrX6sPegsIlKK6S53Og9g1uPPmwqpT_QaM3QuGKA";

// supabase-js 클라이언트 인스턴스 생성 (변수명: supabaseClient)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// HTML 문서가 모두 로드되면 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', function () {

    // ----------------------------------------------------
    // 1. 필요한 HTML 요소들을 id와 선택자로 가져옵니다.
    // ----------------------------------------------------
    // [탭 메뉴 요소]
    const tabOrder = document.getElementById('tab-order');                     // '주문하기' 탭 버튼
    const tabHistory = document.getElementById('tab-history');                 // '주문 내역' 탭 버튼
    const tabContentOrder = document.getElementById('tab-content-order');       // 주문하기 화면
    const tabContentHistory = document.getElementById('tab-content-history');   // 주문 내역 화면
    const orderBadge = document.getElementById('order-badge');                 // 주문 내역 건수 배지

    // [주문서 폼 요소]
    const orderForm = document.getElementById('order-form');                   // 주문서 폼
    const customerNameInput = document.getElementById('customer-name');       // 주문자 이름
    const customerPhoneInput = document.getElementById('customer-phone');     // 전화번호
    const beverageSelect = document.getElementById('beverage-select');         // 메뉴(음료) 선택 드롭다운
    const quantityInput = document.getElementById('quantity');                 // 수량
    const requestsTextarea = document.getElementById('requests');              // 요청사항
    const totalPriceSpan = document.getElementById('total-price');             // 예상 금액 숫자 표시 영역
    const submitButton = document.getElementById('submit-button');             // 주문하기 버튼
    const orderConfirmation = document.getElementById('order-confirmation');   // 주문 확인 메시지 표시 영역
    const sizeRadios = document.querySelectorAll('input[name="size"]');        // 사이즈 라디오 버튼들
    const optionCheckboxes = document.querySelectorAll('input[name="options"]'); // 추가 옵션 체크박스들

    // [주문 내역 요소]
    const ordersList = document.getElementById('orders-list');                 // 주문 카드들이 나열될 컨테이너
    const emptyHistory = document.getElementById('empty-history');             // "주문 내역 없음" 안내 문구
    const historySummary = document.getElementById('history-summary');         // 하단 총 주문 금액 및 전체 삭제 영역
    const totalHistoryAmount = document.getElementById('total-history-amount');// 하단 총 주문 금액 텍스트
    const clearHistoryButton = document.getElementById('clear-history-button');// 내역 모두 지우기 버튼

    // ----------------------------------------------------
    // 2. 주문 내역 데이터 저장소
    // ----------------------------------------------------
    let orders = [];       // 주문 객체들을 저장할 로컬 배열
    let orderNumberSeq = 1; // 1부터 순차적으로 증가하는 주문 번호


    // ----------------------------------------------------
    // 3. 예상 금액 계산 함수 (calculateTotal)
    // ----------------------------------------------------
    /**
     * 선택된 음료, 사이즈, 옵션, 수량을 바탕으로 총 금액을 계산하고 화면에 반영합니다.
     * @returns {number} 계산된 최종 총 금액
     */
    function calculateTotal() {
        // (1) 음료 선택 확인
        const selectedBeverageOption = beverageSelect.options[beverageSelect.selectedIndex];
        const beverageValue = selectedBeverageOption ? selectedBeverageOption.value : '';

        // 음료를 아직 고르지 않았을 경우: 0원으로 표시
        if (!beverageValue) {
            totalPriceSpan.textContent = '0';
            return 0;
        }

        // 음료 기본 가격 읽기 (data-price 속성값)
        const beveragePrice = parseInt(selectedBeverageOption.dataset.price, 10) || 0;

        // (2) 사이즈 추가 금액 읽기
        const checkedSize = document.querySelector('input[name="size"]:checked');
        const sizePrice = checkedSize ? (parseInt(checkedSize.dataset.price, 10) || 0) : 0;

        // (3) 추가 옵션 금액 합산
        const checkedOptions = document.querySelectorAll('input[name="options"]:checked');
        let optionsPrice = 0;
        checkedOptions.forEach(function (option) {
            optionsPrice += parseInt(option.dataset.price, 10) || 0;
        });

        // (4) 수량 읽기 (최소 1)
        let quantity = parseInt(quantityInput.value, 10);
        if (isNaN(quantity) || quantity < 1) {
            quantity = 1;
        }

        // (5) 최종 금액 = (음료 가격 + 사이즈 추가금 + 옵션 합산금) × 수량
        const singleItemPrice = beveragePrice + sizePrice + optionsPrice;
        const total = singleItemPrice * quantity;

        // (6) 천 단위 콤마 형식으로 화면에 표시
        totalPriceSpan.textContent = total.toLocaleString();

        return total;
    }


    // ----------------------------------------------------
    // 4. 주문 내역 화면 렌더링 함수 (renderOrders)
    // ----------------------------------------------------
    /**
     * orders 배열을 바탕으로 주문 내역 카드를 화면에 그립니다.
     * XSS 방지를 위해 사용자가 입력한 모든 텍스트는 textContent로 안전하게 삽입합니다.
     */
    function renderOrders() {
        // 1) 탭 옆의 둥근 갈색 배지 건수 갱신
        orderBadge.textContent = orders.length;

        // 2) 주문 내역이 하나도 없을 때
        if (orders.length === 0) {
            ordersList.innerHTML = '';
            emptyHistory.classList.remove('hidden');    // "아직 주문 내역이 없어요 ☕" 표시
            historySummary.classList.add('hidden');     // 하단 통계/삭제 버튼 숨기기
            return;
        }

        // 3) 주문 내역이 있을 때
        emptyHistory.classList.add('hidden');          // 안내 문구 숨기기
        historySummary.classList.remove('hidden');     // 하단 통계/삭제 버튼 표시
        ordersList.innerHTML = '';                     // 기존 카드 목록 초기화

        let sumAmount = 0; // 누적 총 주문 금액

        // orders 배열의 각 주문을 순회하며 카드 DOM을 생성합니다. (최신 주문이 앞에 위치)
        orders.forEach(function (order, index) {
            sumAmount += order.price;

            // (1) 카드 컨테이너 생성 (베이지 카드 + 왼쪽 갈색 줄)
            const card = document.createElement('div');
            card.className = 'order-card';

            // (2) 카드 상단 영역 (1줄 정보 + 취소 버튼)
            const cardTop = document.createElement('div');
            cardTop.className = 'order-card-top';

            // 1줄: "#1 홍길동님 · 5,000원"
            const line1 = document.createElement('div');
            line1.className = 'order-line-1';
            line1.textContent = `#${order.orderNumber} ${order.name}님 · ${order.price.toLocaleString()}원`;

            // 취소 버튼
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'order-cancel-btn';
            cancelBtn.textContent = '취소';

            // 취소 버튼 클릭 시 confirm으로 확인 후 삭제
            cancelBtn.addEventListener('click', function () {
                const isConfirmed = confirm(`#${order.orderNumber} 주문을 취소하시겠습니까?`);
                if (isConfirmed) {
                    orders.splice(index, 1); // 해당 주문 삭제
                    renderOrders();          // 화면 다시 그리기
                }
            });

            cardTop.appendChild(line1);
            cardTop.appendChild(cancelBtn);

            // 2줄: "카페라떼 M사이즈 (샷 추가) 1잔"
            const line2 = document.createElement('div');
            line2.className = 'order-line-2';
            const optionDisplay = order.optionPart ? ` ${order.optionPart}` : '';
            line2.textContent = `${order.beverageName} ${order.sizeText}${optionDisplay} ${order.quantity}잔`;

            // 3줄: 요청사항(있을 때만) · 주문 시간
            const line3 = document.createElement('div');
            line3.className = 'order-line-3';
            if (order.requests) {
                line3.textContent = `${order.requests} · ${order.orderTime}`;
            } else {
                line3.textContent = order.orderTime;
            }

            // 카드에 각 줄 추가
            card.appendChild(cardTop);
            card.appendChild(line2);
            card.appendChild(line3);

            // 최종 목록에 카드 추가
            ordersList.appendChild(card);
        });

        // 4) 하단 총 주문 금액 요약 업데이트
        totalHistoryAmount.textContent = `총 주문 금액: ${sumAmount.toLocaleString()}원 (${orders.length}건)`;
    }


    // ----------------------------------------------------
    // 5. 탭 메뉴 전환 이벤트
    // ----------------------------------------------------
    tabOrder.addEventListener('click', function () {
        tabOrder.classList.add('active');
        tabHistory.classList.remove('active');

        tabContentOrder.classList.remove('hidden');
        tabContentHistory.classList.add('hidden');
    });

    tabHistory.addEventListener('click', function () {
        tabHistory.classList.add('active');
        tabOrder.classList.remove('active');

        tabContentHistory.classList.remove('hidden');
        tabContentOrder.classList.add('hidden');

        renderOrders();
    });


    // ----------------------------------------------------
    // 6. 입력값 변경 시 실시간 금액 계산 이벤트
    // ----------------------------------------------------
    beverageSelect.addEventListener('change', calculateTotal);

    sizeRadios.forEach(function (radio) {
        radio.addEventListener('change', calculateTotal);
    });

    optionCheckboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', calculateTotal);
    });

    quantityInput.addEventListener('input', calculateTotal);
    quantityInput.addEventListener('change', calculateTotal);


    // ----------------------------------------------------
    // 7. 주문하기 버튼 클릭 (Supabase에 주문 저장)
    // ----------------------------------------------------
    orderForm.addEventListener('submit', async function (event) {
        event.preventDefault(); // 폼 기본 새로고침 방지

        const customerName = customerNameInput.value.trim();
        const customerPhone = customerPhoneInput ? customerPhoneInput.value.trim() : '';

        // 1) 유효성 검사 - 이름
        if (!customerName) {
            alert('이름을 입력해주세요');
            customerNameInput.focus();
            return;
        }

        // 2) 유효성 검사 - 음료
        if (!beverageSelect.value) {
            alert('음료를 선택해주세요');
            beverageSelect.focus();
            return;
        }

        // 3) 주문 정보 추출 및 정리
        const selectedBeverageOption = beverageSelect.options[beverageSelect.selectedIndex];
        const beverageName = selectedBeverageOption.text.replace(/\s*\(.*?\)/, '').trim(); // "카페라떼"
        const beveragePrice = parseInt(selectedBeverageOption.dataset.price, 10) || 0;      // 음료 기본 단가

        // 사이즈 (S, M, L)
        const checkedSize = document.querySelector('input[name="size"]:checked');
        const sizeValue = checkedSize ? checkedSize.value : 'M';
        const sizeText = `${sizeValue}사이즈`;

        // 추가 옵션 이름 목록 (배열)
        const checkedOptionElements = document.querySelectorAll('input[name="options"]:checked');
        const optionNames = []; // 예: ["샷 추가", "크림 추가"]
        checkedOptionElements.forEach(function (opt) {
            const label = document.querySelector(`label[for="${opt.id}"]`);
            if (label) {
                const nameOnly = label.textContent.replace(/\s*\(.*?\)/, '').trim();
                optionNames.push(nameOnly);
            }
        });

        // 수량 및 최종 금액
        const quantity = parseInt(quantityInput.value, 10) || 1;
        const finalPrice = calculateTotal();
        const formattedPrice = finalPrice.toLocaleString();

        // 요청사항
        const requests = requestsTextarea.value.trim();

        // 주문 시간 포맷팅 (예: "오전 10:35")
        const now = new Date();
        const orderTime = now.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // ------------------------------------------------
        // 4) 중복 클릭 방지: 주문하기 버튼 비활성화
        // ------------------------------------------------
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = '주문 저장 중...';

        try {
            // ------------------------------------------------
            // 5) Supabase cafe_orders 테이블에 데이터 저장 (INSERT)
            // 열: customer_name, phone, drink, drink_price, size, options(배열), quantity, request, total_price
            // ------------------------------------------------
            const { data, error } = await supabaseClient
                .from('cafe_orders')
                .insert([
                    {
                        customer_name: customerName,
                        phone: customerPhone,
                        drink: beverageName,
                        drink_price: beveragePrice,
                        size: sizeValue,
                        options: optionNames, // 배열 형태
                        quantity: quantity,
                        request: requests,
                        total_price: finalPrice
                    }
                ])
                .select();

            console.log('Supabase insert 응답 data:', data);
            console.log('Supabase insert 응답 error:', error);

            // 저장 실패 시 에러 던지기
            if (error) {
                throw error;
            }

            // Supabase에 데이터가 실제로 들어갔는지 검증
            if (!data || data.length === 0) {
                throw new Error("Supabase 테이블에서 저장된 데이터를 반환받지 못했습니다.\n테이블 권한(RLS/GRANT)을 확인해주세요.");
            }

            // ------------------------------------------------
            // 6) 저장 성공 처리 (DB에 정상 삽입 완료됨)
            // ------------------------------------------------
            // Supabase에서 자동 생성된 id 번호 사용
            const assignedOrderNumber = data[0].id;
            console.log(`✅ Supabase DB 저장 성공! 주문번호 ID: ${assignedOrderNumber}`);

            // 옵션 괄호 문자열 (예: "(샷 추가)")
            const optionPart = optionNames.length > 0 ? `(${optionNames.join(', ')})` : '';

            // 로컬 orders 목록에 추가
            const newOrder = {
                orderNumber: assignedOrderNumber,
                name: customerName,
                beverageName: beverageName,
                sizeText: sizeText,
                optionPart: optionPart,
                quantity: quantity,
                requests: requests,
                price: finalPrice,
                orderTime: orderTime
            };
            orders.unshift(newOrder);

            // 주문 내역 탭 렌더링 갱신
            renderOrders();

            // 기존 주문 확인 메시지 표시
            const confirmationOptionPart = optionPart ? ` ${optionPart}` : '';
            const confirmationMessage = `${customerName}님, ${beverageName} ${sizeText}${confirmationOptionPart} ${quantity}잔, 총 ${formattedPrice}원 주문이 접수되었습니다!`;

            orderConfirmation.textContent = confirmationMessage;
            orderConfirmation.hidden = false;
            orderConfirmation.classList.remove('hidden');

            // 메시지 위치로 부드럽게 스크롤 이동
            orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (err) {
            // ------------------------------------------------
            // 7) 저장 실패 처리
            // ------------------------------------------------
            console.error('Supabase 주문 저장 에러 상세:', err);
            const errorMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            alert('주문 저장에 실패했어요.\n\n[오류 원인]\n' + errorMessage);
        } finally {
            // ------------------------------------------------
            // 8) 처리 완료 후 버튼 원상 복구 및 활성화
            // ------------------------------------------------
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });


    // ----------------------------------------------------
    // 8. 다시 작성 버튼 클릭 (주문서만 초기화)
    // ----------------------------------------------------
    orderForm.addEventListener('reset', function () {
        setTimeout(function () {
            const sizeMRadio = document.getElementById('size-m');
            if (sizeMRadio) {
                sizeMRadio.checked = true;
            }
            quantityInput.value = '1';

            orderConfirmation.textContent = '';
            orderConfirmation.hidden = true;
            orderConfirmation.classList.add('hidden');

            calculateTotal();
        }, 0);
    });


    // ----------------------------------------------------
    // 9. 내역 모두 지우기 버튼 클릭
    // ----------------------------------------------------
    clearHistoryButton.addEventListener('click', function () {
        if (orders.length === 0) return;

        const isConfirmed = confirm('모든 주문 내역을 삭제하시겠습니까?');
        if (isConfirmed) {
            orders = [];
            renderOrders();
        }
    });


    // ----------------------------------------------------
    // 10. 초기 화면 설정
    // ----------------------------------------------------
    calculateTotal();
    renderOrders();
});
