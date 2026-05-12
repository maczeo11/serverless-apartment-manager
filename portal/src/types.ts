export type MaintenanceRequest = {
    requestId: string;
    title: string;
    description: string;
    category: string;
    priority: "EMERGENCY" | "HIGH" | "MEDIUM" | "LOW";
    status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "CLOSED" | "CANCELLED";
    residentId: string;
    unitNumber: string;
    building: string;
    attachmentUrls: string[];
    slaDeadline: string;
    slaHours: number;
    createdAt: string;
    updatedAt: string;
    comments: Comment[];
    assignedTo: string | null;
    resolvedAt: string | null;
    slaBreached?: boolean;
};

export type Comment = {
    id: string;
    author: string;
    role: "admin" | "resident";
    text: string;
    createdAt: string;
};