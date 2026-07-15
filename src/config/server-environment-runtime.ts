import "server-only";

import {
  parseAdministrationPreviewEnvironment,
  parseSupabaseServerEnvironment,
  type AdministrationPreviewEnvironment,
  type SupabaseServerEnvironment,
} from "./server-environment";

export function readSupabaseServerEnvironment(): SupabaseServerEnvironment {
  return parseSupabaseServerEnvironment(process.env);
}

export function readAdministrationPreviewEnvironment(): AdministrationPreviewEnvironment {
  return parseAdministrationPreviewEnvironment(process.env);
}
