import type { WorkflowInput } from '@/types/workflows';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Initial form values: each input's default, else empty. */
export function initialValues(inputs: WorkflowInput[]): Record<string, string> {
    return Object.fromEntries(inputs.map((i) => [i.name, i.def ?? '']));
}

/** Per-field error messages (the server validates again). Empty when valid. */
export function validateWorkflowInputs(
    inputs: WorkflowInput[],
    values: Record<string, string>
): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const input of inputs) {
        const v = (values[input.name] ?? '').trim();
        if (v === '') {
            if (input.required) {
                errors[input.name] = 'Required';
            }
        } else if (input.type === 'int' && !/^-?\d+$/.test(v)) {
            errors[input.name] = 'Must be a whole number';
        } else if (input.type === 'uuid' && !UUID_RE.test(v)) {
            errors[input.name] = 'Must be a valid UUID';
        }
    }
    return errors;
}
