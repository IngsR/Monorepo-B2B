import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-typewriter-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="typewriter-container" [ngClass]="customClass">
      <span class="typewriter-content">{{ displayedText }}</span>
      <span class="typewriter-cursor"></span>
    </div>
  `,
  styles: [`
    .typewriter-container {
      display: inline-flex;
      align-items: center;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8125rem;
      letter-spacing: -0.01em;
      color: var(--accent-cyan);
    }

    .typewriter-content {
      white-space: pre;
    }

    .typewriter-cursor {
      display: inline-block;
      width: 6px;
      height: 1.1em;
      background-color: var(--accent-cyan);
      margin-left: 3px;
      animation: blink 0.8s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `],
})
export class TypewriterTextComponent implements OnInit, OnDestroy {
  @Input({ required: true }) words: string[] = [];
  @Input() typingSpeed = 60;
  @Input() deletingSpeed = 30;
  @Input() pauseDelay = 2000;
  @Input() customClass = '';

  displayedText = '';
  private currentWordIndex = 0;
  private isDeleting = false;
  private timer: any = null;

  ngOnInit() {
    this.typeNext();
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private typeNext() {
    if (!this.words || this.words.length === 0) return;

    const fullWord = this.words[this.currentWordIndex];

    if (this.isDeleting) {
      this.displayedText = fullWord.substring(0, this.displayedText.length - 1);
    } else {
      this.displayedText = fullWord.substring(0, this.displayedText.length + 1);
    }

    let speed = this.isDeleting ? this.deletingSpeed : this.typingSpeed;

    if (!this.isDeleting && this.displayedText === fullWord) {
      speed = this.pauseDelay;
      this.isDeleting = true;
    } else if (this.isDeleting && this.displayedText === '') {
      this.isDeleting = false;
      this.currentWordIndex = (this.currentWordIndex + 1) % this.words.length;
      speed = 400;
    }

    this.timer = setTimeout(() => this.typeNext(), speed);
  }
}
