(() => {
  "use strict";

  const PARTS = [
    {
      id: "cornea",
      name: "角膜",
      tag: "眼睛的“窗户”",
      icon: "🔍",
      location: "位于眼球最前方，是一层透明的圆弧形组织。",
      function: "让光线进入眼睛，并帮助光线发生第一次重要的折射。"
    },
    {
      id: "lens",
      name: "晶状体",
      tag: "眼睛里的“自动对焦镜头”",
      icon: "🔎",
      location: "位于虹膜和玻璃体之间，像一枚透明的小透镜。",
      function: "可以改变曲度来调节焦距，让我们看清远近不同的物体。"
    },
    {
      id: "retina",
      name: "视网膜",
      tag: "眼睛里的“感光屏幕”",
      icon: "🖥️",
      location: "位于眼球内壁的后部，像一块贴在眼球里的感光屏。",
      function: "感受进入眼睛的光线，并把视觉信息转换成神经信号。"
    },
    {
      id: "optic-nerve",
      name: "视神经",
      tag: "连接眼睛和大脑的“信息通道”",
      icon: "🧠",
      location: "从眼球后方伸出，连接眼睛和大脑。",
      function: "把视网膜产生的视觉信息传递给大脑进行进一步处理。"
    },
    {
      id: "iris",
      name: "虹膜",
      tag: "眼睛里的“光线调节器”",
      icon: "🎨",
      location: "位于角膜后方，瞳孔周围，就是我们看到的眼睛颜色部分。",
      function: "通过改变瞳孔大小，调节进入眼睛的光线量。"
    }
  ];

  const QUESTIONS = [
    {
      question: "眼睛最前方透明的“窗户”是哪一个结构？",
      options: ["视网膜", "角膜", "视神经", "晶状体"],
      answer: 1,
      explain: "角膜位于眼球最前方，透明而弯曲，是光线进入眼睛的重要通道。"
    },
    {
      question: "哪个结构可以改变形状，帮助眼睛看清远近不同的物体？",
      options: ["虹膜", "视网膜", "晶状体", "视神经"],
      answer: 2,
      explain: "晶状体可以通过改变曲度来调节焦距，这个过程叫做调节。"
    },
    {
      question: "哪个结构负责感受光线，并把信息转换成神经信号？",
      options: ["视网膜", "角膜", "虹膜", "晶状体"],
      answer: 0,
      explain: "视网膜含有感光细胞，可以感受光线并把视觉信息转换成神经信号。"
    },
    {
      question: "视神经的主要作用是什么？",
      options: [
        "调节进入眼睛的光线",
        "改变晶状体形状",
        "把视觉信息传递给大脑",
        "保护眼球"
      ],
      answer: 2,
      explain: "视神经就像一条信息通道，把视网膜产生的视觉信息传给大脑。"
    },
    {
      question: "我们眼睛的颜色主要由哪个结构决定？",
      options: ["虹膜", "视网膜", "角膜", "视神经"],
      answer: 0,
      explain: "虹膜就是眼睛有颜色的部分，它还可以调节瞳孔大小。"
    }
  ];

  const state = {
    completed: new Set(),
    buildScore: 100,
    quizScore: 0,
    quizIndex: 0,
    quizAnswered: false,
    drag: null
  };

  const $ = (selector) => document.querySelector(selector);

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    $(id).classList.add("active");
  }

  function updateProgress() {
    $("#progressText").textContent = `已完成 ${state.completed.size} / ${PARTS.length}`;
    $("#scoreText").textContent = state.buildScore;
  }

  function createParts() {
    const tray = $("#partsTray");
    tray.innerHTML = "";

    // 打乱显示顺序
    [...PARTS]
      .sort(() => Math.random() - 0.5)
      .forEach((part) => {
        const el = document.createElement("div");
        el.className = "part";
        el.dataset.part = part.id;
        el.textContent = part.name;

        el.addEventListener("pointerdown", onPointerDown);
        tray.appendChild(el);
      });
  }

  function resetTargets() {
    document.querySelectorAll(".target").forEach((target) => {
      target.classList.remove("completed", "active-target");
      target.querySelector("span").style.opacity = "1";
    });
  }

  function resetGame() {
    state.completed = new Set();
    state.buildScore = 100;
    state.quizScore = 0;
    state.quizIndex = 0;
    state.quizAnswered = false;
    updateProgress();
    resetTargets();
    createParts();
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;

    const part = event.currentTarget;
    if (part.classList.contains("completed")) return;

    event.preventDefault();

    const rect = part.getBoundingClientRect();

    const clone = part.cloneNode(true);
    clone.classList.add("drag-clone", "dragging");
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    document.body.appendChild(clone);

    state.drag = {
      partId: part.dataset.part,
      source: part,
      clone,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };

    part.style.opacity = "0.25";
    moveDrag(event);

    window.addEventListener("pointermove", moveDrag, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerCancel, { once: true });
  }

  function moveDrag(event) {
    if (!state.drag) return;

    event.preventDefault();

    const { clone, offsetX, offsetY } = state.drag;

    clone.style.left = `${event.clientX - offsetX}px`;
    clone.style.top = `${event.clientY - offsetY}px`;

    highlightTarget(event.clientX, event.clientY);
  }

  function highlightTarget(x, y) {
    document.querySelectorAll(".target").forEach((target) => {
      target.classList.remove("active-target");
    });

    const target = getTargetAtPoint(x, y);
    if (target && !target.classList.contains("completed")) {
      target.classList.add("active-target");
    }
  }

  function getTargetAtPoint(x, y) {
    const target = document
      .elementsFromPoint(x, y)
      .find((el) => el.classList && el.classList.contains("target"));

    return target || null;
  }

  function onPointerUp(event) {
    window.removeEventListener("pointermove", moveDrag);

    if (!state.drag) return;

    const drag = state.drag;
    const target = getTargetAtPoint(event.clientX, event.clientY);

    finishDrag();

    if (target && target.dataset.target === drag.partId) {
      handleCorrect(drag.partId, target);
    } else {
      handleWrong(drag.partId);
    }
  }

  function onPointerCancel() {
    window.removeEventListener("pointermove", moveDrag);
    if (!state.drag) return;
    finishDrag();
  }

  function finishDrag() {
    if (!state.drag) return;

    state.drag.clone.remove();
    state.drag.source.style.opacity = "";
    document.querySelectorAll(".target").forEach((target) => {
      target.classList.remove("active-target");
    });

    state.drag = null;
  }

  function handleCorrect(partId, target) {
    if (state.completed.has(partId)) return;

    state.completed.add(partId);

    const source = document.querySelector(`[data-part="${partId}"]`);
    source.classList.add("completed");

    target.classList.add("completed");

    // 用对应颜色的简单实体结构替代虚线区域
    target.querySelector("span").style.opacity = "0";

    const flash = $("#successFlash");
    flash.classList.remove("show");
    void flash.offsetWidth;
    flash.classList.add("show");

    updateProgress();

    const part = PARTS.find((item) => item.id === partId);

    setTimeout(() => {
      showInfoCard(part);
    }, 350);
  }

  function handleWrong(partId) {
    state.buildScore = Math.max(0, state.buildScore - 5);
    updateProgress();
    showToast("位置不对，再试试看");
  }

  function showInfoCard(part) {
    $("#infoIcon").textContent = part.icon;
    $("#infoPartName").textContent = part.name;
    $("#infoTag").textContent = part.tag;
    $("#infoLocation").textContent = part.location;
    $("#infoFunction").textContent = part.function;

    showScreen("#infoScreen");
  }

  function continueBuild() {
    if (state.completed.size >= PARTS.length) {
      showCompleteScreen();
    } else {
      showScreen("#gameScreen");
    }
  }

  function showCompleteScreen() {
    $("#finalScore").textContent = state.buildScore;
    $("#finalCorrect").textContent = `${state.completed.size}/${PARTS.length}`;
    showScreen("#completeScreen");
  }

  function startQuiz() {
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    $("#quizScore").textContent = "0";
    showScreen("#quizScreen");
    renderQuestion();
  }

  function renderQuestion() {
    const question = QUESTIONS[state.quizIndex];

    $("#quizProgress").textContent =
      `第 ${state.quizIndex + 1} / ${QUESTIONS.length} 题`;

    $("#questionNumber").textContent =
      `QUESTION ${String(state.quizIndex + 1).padStart(2, "0")}`;

    $("#questionText").textContent = question.question;

    const options = $("#options");
    options.innerHTML = "";

    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "option";
      button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
      button.dataset.index = index;
      button.addEventListener("click", () => answerQuestion(index));
      options.appendChild(button);
    });

    $("#quizFeedback").textContent = "";
    $("#quizFeedback").className = "quiz-feedback";
    $("#nextQuestionBtn").classList.add("hidden");

    state.quizAnswered = false;
  }

  function answerQuestion(index) {
    if (state.quizAnswered) return;

    state.quizAnswered = true;

    const question = QUESTIONS[state.quizIndex];
    const optionEls = [...document.querySelectorAll(".option")];

    optionEls.forEach((button) => {
      button.classList.add("disabled");

      const buttonIndex = Number(button.dataset.index);

      if (buttonIndex === question.answer) {
        button.classList.add("correct");
      }
    });

    if (index === question.answer) {
      state.quizScore += 20;
      $("#quizFeedback").textContent = `✓ 回答正确！${question.explain}`;
      $("#quizFeedback").className = "quiz-feedback correct-text";
    } else {
      optionEls[index].classList.add("wrong");
      $("#quizFeedback").textContent =
        `✕ 这次没答对。正确答案是“${question.options[question.answer]}”。${question.explain}`;
      $("#quizFeedback").className = "quiz-feedback wrong-text";
    }

    $("#quizScore").textContent = state.quizScore;
    $("#nextQuestionBtn").classList.remove("hidden");
  }

  function nextQuestion() {
    if (state.quizIndex < QUESTIONS.length - 1) {
      state.quizIndex++;
      renderQuestion();
    } else {
      showResult();
    }
  }

  function showResult() {
    const total = state.buildScore + state.quizScore;

    $("#totalScore").textContent = total;
    $("#resultBuildScore").textContent = state.buildScore;
    $("#resultQuizScore").textContent = state.quizScore;

    let message = "";

    if (total >= 190) {
      message = "太棒了！你已经熟悉了这些眼球结构及它们的基本功能。";
    } else if (total >= 150) {
      message = "完成得不错！再玩一次，可以挑战更高分数。";
    } else {
      message = "已经完成学习啦！再挑战一次，记住这些结构的位置和作用吧。";
    }

    $("#resultMessage").textContent = message;
    showScreen("#resultScreen");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1500);
  }

  // 开始
  $("#startBtn").addEventListener("click", () => {
    resetGame();
    showScreen("#gameScreen");
  });

  // 科普卡片继续
  $("#continueBtn").addEventListener("click", continueBuild);

  // 完成后进入问答
  $("#quizBtn").addEventListener("click", startQuiz);

  // 下一题
  $("#nextQuestionBtn").addEventListener("click", nextQuestion);

  // 重新挑战
  $("#restartBtn").addEventListener("click", () => {
    resetGame();
    showScreen("#gameScreen");
  });

  // 初始化
  updateProgress();
})();
