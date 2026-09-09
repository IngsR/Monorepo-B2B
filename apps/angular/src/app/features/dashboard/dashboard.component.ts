import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { UserRole } from '../../core/enums/user-role.enum';
import { AuthService } from '../../core/services/auth.service';

interface HealthStatus {
  status: string;
  service: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly UserRole = UserRole;
  readonly healthStatus = signal<HealthStatus | null>(null);
  readonly isHealthLoading = signal(false);

  ngOnInit(): void {
    this.checkHealth();
  }

  checkHealth(): void {
    this.isHealthLoading.set(true);
    this.http.get<HealthStatus>(`${environment.apiUrl}/health`).subscribe({
      next: (res) => {
        this.healthStatus.set(res);
        this.isHealthLoading.set(false);
      },
      error: () => {
        this.healthStatus.set(null);
        this.isHealthLoading.set(false);
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
