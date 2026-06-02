import { fetchAuthSession } from 'aws-amplify/auth';
import type { MaintenanceRequest } from './types';


const API = import.meta.env.VITE_API_URL;

async function getAuthToken() {
    try {
        const { tokens } = await fetchAuthSession();
        return tokens?.idToken?.toString();
    } catch (err) {
        return null;
    }
}

async function request(endpoint: string, options: RequestInit = {}) {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {})
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        let errorMsg = 'An error occurred';
        try {
            const errorObj = await response.json();
            errorMsg = errorObj.error || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
    }

    return response.json();
}

export async function getRequests(status?: string): Promise<{ items: MaintenanceRequest[], nextToken: string | null }> {
    const url = status ? `/requests?status=${status}` : '/requests';
    return request(url);
}

export async function getRequest(id: string): Promise<MaintenanceRequest> {
    return request(`/requests/${id}`);
}

export async function createRequest(data: Partial<MaintenanceRequest>): Promise<{ requestId: string, message: string }> {
    return request('/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

export async function updateRequestStatus(id: string, status: string, assignedTo?: string): Promise<any> {
    const body: any = { status };
    if (assignedTo !== undefined) body.assignedTo = assignedTo;

    return request(`/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

export async function addComment(id: string, comment: string): Promise<any> {
    return request(`/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
    });
}