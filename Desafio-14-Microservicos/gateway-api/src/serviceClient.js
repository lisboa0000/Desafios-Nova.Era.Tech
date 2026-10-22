const { log } = require('./logger');

class UpstreamError extends Error {
  constructor(service, message, { status, body } = {}) {
    super(message);
    this.service = service;
    this.status = status;
    this.body = body;
  }
}

class CircuitBreaker {
  constructor({ failureThreshold = 3, resetMs = 10000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetMs = resetMs;
    this.failures = 0;
    this.openedAt = null;
  }

  get state() {
    if (this.openedAt === null) return 'closed';
    return Date.now() - this.openedAt >= this.resetMs ? 'half-open' : 'open';
  }

  canRequest() {
    return this.state !== 'open';
  }

  onSuccess() {
    this.failures = 0;
    this.openedAt = null;
  }

  onFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openedAt = Date.now();
  }
}

class ServiceClient {
  constructor({ name, baseUrl, timeoutMs, breaker }) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.breaker = new CircuitBreaker(breaker);
  }

  async get(path, { requestId } = {}) {
    if (!this.breaker.canRequest()) {
      throw new UpstreamError(this.name, `circuito aberto para ${this.name}`);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: requestId ? { 'x-request-id': requestId } : {},
      });
      const body = await res.json().catch(() => null);
      if (res.status >= 500) {
        this.breaker.onFailure();
        throw new UpstreamError(this.name, `${this.name} respondeu ${res.status}`, { status: res.status, body });
      }
      this.breaker.onSuccess();
      if (!res.ok) throw new UpstreamError(this.name, `${this.name} respondeu ${res.status}`, { status: res.status, body });
      return body;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      this.breaker.onFailure();
      const reason = err.name === 'AbortError' ? `timeout de ${this.timeoutMs}ms` : err.message;
      log('error', 'falha ao chamar servico', { upstream: this.name, requestId, reason });
      throw new UpstreamError(this.name, `${this.name} indisponivel: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { ServiceClient, CircuitBreaker, UpstreamError };
