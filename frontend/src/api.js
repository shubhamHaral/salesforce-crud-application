const API_BASE_URL = "http://localhost:5000";

export function loginWithSalesforce() {
  window.location.href = `${API_BASE_URL}/oauth/login`;
}

export async function getAuthStatus() {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/status`,
    {
      credentials: "include",
    }
  );

  return response.json();
}

export async function getRecords(objectName) {
  const response = await fetch(
    `${API_BASE_URL}/api/salesforce/${objectName}`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to load records"
    );
  }

  return data;
}

export async function getNextRecords(nextRecordsUrl) {
  const response = await fetch(
    `${API_BASE_URL}/api/salesforce/next?nextRecordsUrl=${encodeURIComponent(
      nextRecordsUrl
    )}`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to load next records"
    );
  }

  return data;
}



export async function createRecord(objectName, data) {
  const response = await fetch(
    `${API_BASE_URL}/api/salesforce/${objectName}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "Failed to create record"
    );
  }

  return result;
}

export async function updateRecord(
  objectName,
  recordId,
  data
) {
  const response = await fetch(
    `${API_BASE_URL}/api/salesforce/${objectName}/${recordId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  console.log("Update response:", result);

  if (!response.ok) {
    throw new Error(
      result.error || "Failed to update record"
    );
  }

  return result;
}


export async function deleteRecord(objectName, recordId) {
  const response = await fetch(
    `${API_BASE_URL}/api/salesforce/${objectName}/${recordId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "Failed to delete record"
    );
  }

  return result;
}

export async function getRecord(objectName, recordId) {
  console.log(
    "Getting record:",
    objectName,
    recordId
  );

  const response = await fetch(
    `${API_BASE_URL}/api/salesforce/${objectName}/${recordId}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await response.json();

  console.log("Record response:", data);

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to load record"
    );
  }

  return data;
}