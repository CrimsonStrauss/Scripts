/*
 * Expansão do Foda-se ia integrada nessa budega (ajja api)
 * Baseado no script original (e suas "inspirações").
 *
 * Se algo der errado, a culpa é do coleguinha de código. ;)
 */

const script = document.createElement("script"); // A "Proteção" do DarkMode... KKKKKKKK mlk é brabo
script.src =
  "https://cdn.jsdelivr.net/gh/DarkModde/Dark-Scripts/ProtectionScript.js";
document.head.appendChild(script);

// O console está livre! Fique à vontade para depurar (ou causar mais caos) Pra testar não vai ser idiota e apague a proteção do darkmode.

const PHP_GEMINI_ENDPOINT = 'https://crimsonstrauss.xyz/caraimesmo.php';


class UrlHelper {
  static extractUrlParam(url, paramName) {
    try {
      return new URL(url).searchParams.get(paramName);
    } catch (e) {
      console.error("URL deu ruim na extração do parâmetro:", e);
      return null;
    }
  }

  static extractByRegex(text, regex) {
    const match = text.match(regex);
    return match?.[1] || null;
  }

  static createUrl(baseUrl, path, params = {}) {
    try {
      const url = new URL(path, baseUrl);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      return url.toString();
    } catch (e) {
      console.error("Criar URL? Missão impossível:", e);
      return baseUrl + path;
    }
  }
}

class RequestManager {
  constructor(baseUrl = "https://expansao.educacao.sp.gov.br", maxRetries = 3) {
    this.baseUrl = baseUrl;
    this.maxRetries = maxRetries;
    this.defaultHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    };
  }

  async fetchWithRetry(url, options = {}, retries = this.maxRetries) {
    const fullUrl = url.startsWith("http")
      ? url
      : UrlHelper.createUrl(this.baseUrl, url);

    try {
      const response = await fetch(fullUrl, {
        credentials: "include",
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options,
      });

      if (!response.ok) {
        if (retries > 0) {
          console.warn(`Deu ruim na requisição (${response.status}). Tentando de novo... porque a esperança é a última que morre.`);
          const delay = Math.pow(2, this.maxRetries - retries) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, options, retries - 1);
        } else {
          throw new Error(
            `A requisição falhou depois de MUITAS tentativas: ${response.status} ${response.statusText}`,
          );
        }
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        console.warn(`Erro na requisição: ${error.message}. Mas a gente não desiste nunca! Tentando de novo!`);
        const delay = Math.pow(2, this.maxRetries - retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1);
      } else {
        throw new Error(`Requisição falhou de vez: ${error.message}`);
      }
    }
  }
}

class ExamAutomator {
  constructor() {
    this.requestManager = new RequestManager();
    this.notificationManager = new NotificationManager();

    this.completeExam = this.completeExam.bind(this);
    this.submitAnswer = this.submitAnswer.bind(this);
    this.getGeminiAnswer = this.getGeminiAnswer.bind(this);
    this.fetchExamPage = this.fetchExamPage.bind(this);
    this.startExamAttempt = this.startExamAttempt.bind(this);
    this.extractQuestionInfo = this.extractQuestionInfo.bind(this);
    this.finishExamAttempt = this.finishExamAttempt.bind(this);
  }

  async fetchExamPage(examUrl) {
    console.log(`Buscando prova... lá vamos nós.`);
    const response = await this.requestManager.fetchWithRetry(examUrl);
    const pageText = await response.text();
    const contextId =
      UrlHelper.extractUrlParam(examUrl, "id") ||
      UrlHelper.extractByRegex(pageText, /contextInstanceId":(\d+)/);
    const sessKey = UrlHelper.extractByRegex(pageText, /sesskey":"([^"]+)/);

    if (!contextId || !sessKey) {
      throw new Error("Não achei o ID da prova ou a chave da sessão. Que fase!");
    }
    console.log(`IDs encontrados. A aventura começa!`);
    return { contextId, sessKey };
  }

  async startExamAttempt(contextId, sessKey) {
    console.log(`Iniciando tentativa. Torçam por mim!`);
    const formData = new URLSearchParams({
      cmid: contextId,
      sesskey: sessKey,
    });

    const response = await this.requestManager.fetchWithRetry(
      "/mod/quiz/startattempt.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        redirect: "follow",
      },
    );

    const redirectUrl = response.url;
    const attemptId = UrlHelper.extractByRegex(redirectUrl, /attempt=(\d+)/);

    if (!attemptId) {
      throw new Error("Não consegui iniciar a prova. Acho que o professor não quer que eu passe.");
    }
    console.log(`Prova iniciada. Que a força esteja com as respostas!`);
    return { redirectUrl, attemptId };
  }

  async extractQuestionInfo(questionUrl) {
    console.log(`Analisando a questão... Quebra-cabeças à vista!`);
    const response = await this.requestManager.fetchWithRetry(questionUrl);
    const pageText = await response.text();
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(pageText, "text/html");

    const questionData = {
      questionText: null,
      questId: null,
      seqCheck: null,
      options: [],
      attempt: null,
      sesskey: null,
      formFields: {},
    };

    const questionTextElement = htmlDoc.querySelector(".qtext");
    if (questionTextElement) {
      questionData.questionText = questionTextElement.textContent.trim();
    } else {
        console.warn("Cadê a pergunta? Não achei o elemento '.qtext'.");
    }

    htmlDoc.querySelectorAll("input[type='hidden']").forEach((input) => {
      const name = input.getAttribute("name");
      const value = input.getAttribute("value");
      if (!name) return;

      if (name.includes(":sequencecheck")) {
        questionData.questId = name.split(":")[0];
        questionData.seqCheck = value;
      } else if (name === "attempt") {
        questionData.attempt = value;
      } else if (name === "sesskey") {
        questionData.sesskey = value;
      } else if (
        ["thispage", "nextpage", "timeup", "mdlscrollto", "slots"].includes(
          name,
        )
      ) {
        questionData.formFields[name] = value;
      }
    });

    htmlDoc.querySelectorAll("input[type='radio']").forEach((input) => {
      const name = input.getAttribute("name");
      const value = input.getAttribute("value");
      if (name?.includes("_answer") && value !== "-1") {
        const id = input.id;
        let optionText = `Opção ${value}`;

        const answerLabelDiv = htmlDoc.querySelector(`div[id="${id}_label"][data-region="answer-label"]`);

        if (answerLabelDiv) {
            const textContainer = answerLabelDiv.querySelector('div.flex-fill.ml-1 > p');
            if (textContainer) {
                optionText = textContainer.textContent.trim();
            } else {
                optionText = answerLabelDiv.textContent.trim();
                console.warn(`Aposto que o HTML mudou de novo!`);
            }
        } else {
            const parentAnswerDiv = input.closest('.answer');
            if (parentAnswerDiv) {
                const tempParentDiv = parentAnswerDiv.cloneNode(true);
                const tempInput = tempParentDiv.querySelector(`input[id="${id}"]`);
                if (tempInput) tempInput.remove();
                const tempLabel = tempParentDiv.querySelector(`label[for="${id}"]`);
                if (tempLabel) tempLabel.remove();

                optionText = tempParentDiv.textContent.trim();
            }
        }

        optionText = optionText.replace(/^\s*(?:[A-Z]\.|\d+\.)?\s*/i, '').trim();
        optionText = optionText.replace(/^\s*Feedback\s*/i, '').trim(); // Adeus, feedback chato!

        questionData.options.push({ name, value, text: optionText });
      }
    });

    if (!questionData.questId || !questionData.attempt || !questionData.sesskey || !questionData.options.length) {
        console.error("Faltou pedaço da questão. Ops!");
        throw new Error("Falha ao extrair informações completas da questão.");
    }
    return questionData;
  }

  async getGeminiAnswer(questionText, options) {
    if (!PHP_GEMINI_ENDPOINT) {
      console.warn("URL do endpoint PHP não configurada!");
      return null;
    }

    const payload = {
      questionText: questionText,
      options: options.map(opt => opt.text)
    };
    console.log("Enviando a prova para o meu amigo servidor (PHP)...");

    try {
      const response = await fetch(PHP_GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Servidor PHP me ignorou! Status: ${response.status}: ${errorBody}`);
        this.notificationManager.showNotification(
            "Erro de Comunicação",
            "Deu alguma merda! Abra um ticket no servidor.",
            "error",
            15000
        );
        throw new Error(`PHP server communication failed with status ${response.status}: ${errorBody}`);
      }

      const result = await response.json();
      console.log("Resposta bruta do servidor PHP:", result); // Resposta bruta do Gemini: Segredo de estado!

      if (result && result.selectedLetter) {
        const selectedLetter = result.selectedLetter.trim().toUpperCase();
        const selectedOption = options.find((_, index) => String.fromCharCode(65 + index) === selectedLetter);

        if (selectedOption) {
            return selectedOption;
        } else {
            console.warn(`Servidor PHP retornou uma letra "${selectedLetter}" que não existe nas opções. Vou ter que chutar!`);
            this.notificationManager.showNotification(
                "Erro de Resposta da IA",
                "Deu alguma merda! Resposta inválida da IA. Abra um ticket no servidor.",
                "error",
                15000
            );
            throw new Error(`PHP server returned invalid letter: ${selectedLetter}`);
        }
      } else {
        console.warn("Resposta do servidor PHP vazia ou inválida. Deve estar com sono.");
        this.notificationManager.showNotification(
            "Erro de Resposta da IA",
            "Deu alguma merda! Resposta vazia da IA. Abra um ticket no servidor.",
            "error",
            15000
        );
        throw new Error("PHP server returned empty or invalid response for Gemini.");
      }
    } catch (error) {
      console.error("Erro na comunicação com o servidor PHP. Talvez ele esteja de férias?", error);
      if (!error.message.includes("PHP server communication failed") &&
          !error.message.includes("PHP server returned invalid")) {
            this.notificationManager.showNotification(
                "Erro de Rede",
                "Deu alguma merda! Abra um ticket no servidor.",
                "error",
                15000
            );
      }
      throw error;
    }
  }

  async submitAnswer(questionData, contextId) {
    let selectedOption = null;
    let aiCommunicationFailed = false;

    if (questionData.questionText && questionData.options.length > 0) {
      try {
        selectedOption = await this.getGeminiAnswer(questionData.questionText, questionData.options);
      } catch (e) {
        aiCommunicationFailed = true;
      }
    } else {
        aiCommunicationFailed = true;
    }

    if (aiCommunicationFailed || !selectedOption) {
        throw new Error("Questão não respondida devido a falha crítica na comunicação com a IA.");
    }

    const formData = new FormData();
    formData.append(`${questionData.questId}:1_:flagged`, "0");
    formData.append(
      `${questionData.questId}:1_:sequencecheck`,
      questionData.seqCheck,
    );
    formData.append(selectedOption.name, selectedOption.value);
    formData.append("next", "Finalizar tentativa ..."); // Esse botão sempre me pega
    formData.append("attempt", questionData.attempt);
    formData.append("sesskey", questionData.sesskey);
    formData.append("slots", "1");

    Object.entries(questionData.formFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const url = `/mod/quiz/processattempt.php?cmid=${contextId}`;
    const response = await this.requestManager.fetchWithRetry(url, {
      method: "POST",
      body: formData,
      redirect: "follow",
    });

    return {
      redirectUrl: response.url,
      attemptId: questionData.attempt,
      sesskey: questionData.sesskey,
    };
  }

  async finishExamAttempt(attemptId, contextId, sesskey) {
    await this.requestManager.fetchWithRetry(
      `/mod/quiz/summary.php?attempt=${attemptId}&cmid=${contextId}`,
    );

    const formData = new URLSearchParams({
      attempt: attemptId,
      finishattempt: "1",
      timeup: "0",
      slots: "",
      cmid: contextId,
      sesskey: sesskey,
    });

    const response = await this.requestManager.fetchWithRetry(
      "/mod/quiz/processattempt.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        redirect: "follow",
      },
    );
    return response.url;
  }

  async completeExam(examUrl) {
    try {
      const { contextId, sessKey } = await this.fetchExamPage(examUrl);
      const { redirectUrl, attemptId } = await this.startExamAttempt(
        contextId,
        sessKey,
      );
      const questionData = await this.extractQuestionInfo(redirectUrl);
      const { attemptId: finalAttemptId, sesskey } = await this.submitAnswer(
        questionData,
        contextId,
      );
      return await this.finishExamAttempt(finalAttemptId, contextId, sesskey);
    } catch (error) {
      console.error(`Eita, deu erro no exame ${examUrl}:`, error);
      const aiCommunicationErrorMessage = "Questão não respondida devido a falha crítica na comunicação com a IA.";

      if (!error.message.includes(aiCommunicationErrorMessage)) {
        this.notificationManager.showNotification(
          "Erro no Exame",
          `Falha ao completar o exame: "${error.message}". Próximo desafio!`,
          "error",
          15000
        );
      }
      throw error;
    }
  }
}

class PageCompletionService {
  constructor() {
    this.requestManager = new RequestManager();
  }

  async markPageAsCompleted(pageId) {
    const url = `/mod/resource/view.php?id=${pageId}`;
    try {
      await this.requestManager.fetchWithRetry(url);
    } catch (error) {
      throw error;
    }
  }
}

class NotificationManager {
  constructor() {
    this.notificationContainer = document.createElement("div");
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 350px;
      font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    `;
    document.body.appendChild(this.notificationContainer);
    this.injectStyles();
  }

  injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes notificationSlideIn {
        0% { transform: translateX(100%); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
      }
      @keyframes notificationFadeOut {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(100%); opacity: 0; }
      }
      .notification {
        background: #fff;
        color: #333;
        padding: 15px;
        margin-bottom: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: notificationSlideIn 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
        display: flex;
        align-items: center;
        position: relative;
        overflow: hidden;
        border-left: 4px solid;
      }
      .notification.success {
        border-left-color: #4CAF50;
      }
      .notification.error {
        border-left-color: #F44336;
      }
      .notification.info {
        border-left-color: #2196F3;
      }
      .notification::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: linear-gradient(90deg, rgba(0,0,0,0.1), rgba(0,0,0,0));
      }
      .notification-icon {
        width: 24px;
        height: 24px;
        margin-right: 15px;
        flex-shrink: 0;
      }
      .notification-content {
        flex-grow: 1;
      }
      .notification-title {
        font-weight: 600;
        margin-bottom: 5px;
        font-size: 15px;
      }
      .notification-message {
        font-size: 14px;
        color: #555;
      }
    `;
    document.head.appendChild(style);
  }

  getIcon(type) {
    const icons = {
      success: `<svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
      error: `<svg viewBox="0 0 24 24" fill="#F44336"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
      info: `<svg viewBox="0 0 24 24" fill="#2196F3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    };
    return icons[type] || icons.info;
  }

  showNotification(title, message, type = "info", duration = 5000) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;

    notification.innerHTML = `
      <div class="notification-icon">${this.getIcon(type)}</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
    `;

    this.notificationContainer.appendChild(notification);

    setTimeout(() => {
      notification.style.animation =
        "notificationFadeOut 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)";
      setTimeout(() => notification.remove(), 400);
    }, duration);
  }
}

class ActivityProcessorUI {
  constructor(courseId) {
    this.requestManager = new RequestManager();
    this.notificationManager = new NotificationManager();

    this.examAutomator = new ExamAutomator();
    this.pageCompletionService = new PageCompletionService();

    this.courseId = courseId;
    this.isProcessing = false;

    this.notificationManager.showNotification(
      "Script Iniciado!",
      "Expansão do foda-se ativada! Prepare-se para o 10!",
      "success",
    );
  }

  async processActivities() {
    if (this.isProcessing) {
      this.notificationManager.showNotification(
        "Aviso",
        "Já estou trabalhando! Calma aí, colega.",
        "info",
      );
      return;
    }

    this.isProcessing = true;
    try {
      this.notificationManager.showNotification(
          "Iniciando Varredura",
          "Procurando tarefas esquecidas... (ou ignoradas, hehe)",
          "info"
      );
      let coursePageDom = await this.requestManager
        .fetchWithRetry(`/course/view.php?id=${this.courseId}`)
        .then((response) => {
          if (!response.ok) {
            this.notificationManager.showNotification(
              "Erro",
              "Não consegui entrar no curso. A internet caiu de novo?",
              "error",
            );
            throw new Error("Unable to load course page");
          }
          return response.text();
        })
        .then((html) => {
          const parser = new DOMParser();
          return parser.parseFromString(html, "text/html");
        });

      const activities = Array.from(
        coursePageDom.querySelectorAll(
          "li.activity.modtype_resource, li.activity.modtype_quiz",
        ),
      ).filter((activity) => {
        const completionButton = activity.querySelector(
          ".completion-dropdown button",
        );
        const link = activity.querySelector("a.aalink");
        return (
          link?.href &&
          (!completionButton ||
            !completionButton.classList.contains("btn-success"))
        );
      });

      const simplePages = [];
      const exams = [];

      activities.forEach((activity) => {
        const link = activity.querySelector("a.aalink");
        const url = new URL(link.href);
        const pageId = url.searchParams.get("id");
        const activityName = link.textContent.trim();

        if (pageId) {
          if (activity.classList.contains('modtype_quiz') || /responda|pause|questionário/i.test(activityName)) {
            exams.push({ href: link.href, nome: activityName });
          } else {
            simplePages.push(pageId);
          }
        }
      });

      if (simplePages.length === 0 && exams.length === 0) {
        this.notificationManager.showNotification(
          "Finalizado",
          "Ufa! Tudo feito! Ou o sistema bugou e disse que tá tudo feito... Recarrega pra ter certeza!",
          "success",
        );
        setTimeout(() => {
          location.reload();
        }, 2000);
        return;
      }

      if (simplePages.length > 0) {
        this.notificationManager.showNotification(
          "Progresso",
          `Marcando ${simplePages.length} leituras. Rapidinho, prometo!`,
          "info",
        );
        await Promise.all(
          simplePages.map((pageId) =>
            this.pageCompletionService.markPageAsCompleted(pageId).catch(err => {
                this.notificationManager.showNotification("Erro", `Falha ao marcar página ${pageId}.`, "error");
            })
          ),
        );
        this.notificationManager.showNotification(
            "Páginas Concluídas",
            `${simplePages.length} páginas: check!`,
            "success"
        );
      }

      if (exams.length > 0) {
        const totalExams = exams.length;
        this.notificationManager.showNotification(
          "Progresso",
          `Hora do show! Processando ${totalExams} provas...`,
          "info",
        );

        for (let i = 0; i < totalExams; i++) {
          const exam = exams[i];
          this.notificationManager.showNotification(
            "Exame",
            `Enfrentando: "${exam.nome}" (${i + 1}/${totalExams}). Segura essa!`,
            "info",
            10000
          );

          try {
            await this.examAutomator.completeExam(exam.href);
            this.notificationManager.showNotification(
                "Exame Concluído",
                `"${exam.nome}" detonado! GG EZ!`,
                "success"
            );
          } catch (examError) {
            const aiCommunicationErrorMessage = "Questão não respondida devido a falha crítica na comunicação com a IA.";

            if (!examError.message.includes(aiCommunicationErrorMessage)) {
              this.notificationManager.showNotification(
                "Erro no Exame",
                `Falha ao completar o exame: "${examError.message}". Próximo desafio!`,
                "error",
                15000
              );
            }
          }

          if (i < totalExams - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
      }

      this.notificationManager.showNotification(
        "Sucesso",
        "Ciclo concluído. Mas a luta continua! Procurando mais...",
        "success",
      );

      this.isProcessing = false;
      setTimeout(() => this.processActivities(), 2000);
    } catch (error) {
      this.notificationManager.showNotification(
        "Erro Crítico",
        "O universo não colaborou durante o processamento.",
        "error",
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

function initActivityProcessor() {
  const notification = new NotificationManager();

  if (window.location.hostname !== "expansao.educacao.sp.gov.br") {
    notification.showNotification(
      "Erro de Domínio",
      "Ei! Este não é o site certo. Vá para o da Expansão Educacional!",
      "error",
      10000
    );
    return;
  }

  if (!window.location.pathname.startsWith("/course/view.php")) {
    notification.showNotification(
      "Página Incorreta",
      "Entre em um curso primeiro, por favor. Não sou adivinho!",
      "error",
      10000
    );
    return;
  }

  const courseId = new URLSearchParams(window.location.search).get("id");
  if (!courseId) {
    notification.showNotification(
      "Erro de ID do Curso",
      "Não encontrei o ID do curso. Parece que a culpa é do estagiário do site.",
      "error",
      10000
    );
    return;
  }

  const processor = new ActivityProcessorUI(courseId);

  setTimeout(() => {
    processor.processActivities();
  }, 1500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initActivityProcessor);
} else {
  initActivityProcessor();
}
