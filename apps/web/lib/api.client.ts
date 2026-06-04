type ApiResponse<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } }

export const clientFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const json = (await res.json()) as ApiResponse<T>
    if (!json.success) throw new Error(json.error?.message ?? '요청에 실패했습니다')
    return json.data
}
