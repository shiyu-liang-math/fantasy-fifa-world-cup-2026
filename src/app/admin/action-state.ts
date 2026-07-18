import type {
  ResultEntryFieldErrors,
  ResultReview,
} from "@/services/administration/result-entry";

export type LoginActionState = Readonly<{
  status: "idle" | "error";
  message?: string;
}>;

export type PreviewActionState =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      status: "error";
      message: string;
      fieldErrors?: ResultEntryFieldErrors;
      issues?: readonly string[];
    }>
  | Readonly<{ status: "ready"; review: ResultReview }>;

export type ApplyActionState =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      status: "error";
      message: string;
      discardReview: boolean;
    }>
  | Readonly<{
      status: "success";
      message: string;
      revision: string;
    }>;

export const INITIAL_LOGIN_STATE: LoginActionState = { status: "idle" };
export const INITIAL_PREVIEW_STATE: PreviewActionState = { status: "idle" };
export const INITIAL_APPLY_STATE: ApplyActionState = { status: "idle" };
