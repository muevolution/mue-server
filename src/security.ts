import * as bcrypt from "bcryptjs";

export async function hashPassword(password: string, salt?: string) {
    const setSalt = salt || await bcrypt.genSalt();
    return bcrypt.hash(password, setSalt);
}

export function comparePasswords(stored: string, provided: string) {
    return bcrypt.compare(provided, stored);
}
