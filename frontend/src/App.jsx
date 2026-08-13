import { useEffect, useState } from "react";

import {
  loginWithSalesforce,
  getAuthStatus,
  getRecords,
  getNextRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from "./api";

import "./App.css";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [objectName, setObjectName] = useState("Account");
  const [records, setRecords] = useState([]);
  const [nextRecordsUrl, setNextRecordsUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [newRecord, setNewRecord] = useState({});

  const objects = [
    "Account",
    "Opportunity",
    "Lead",
    "Contact",
    "Case",
  ];

  const createFields = {
    Account: [
      { name: "Name", label: "Account Name", required: true },
      { name: "Phone", label: "Phone" },
      { name: "Website", label: "Website" },
      { name: "Industry", label: "Industry" },
      { name: "Type", label: "Type" },
    ],

    Opportunity: [
      { name: "Name", label: "Opportunity Name", required: true },
      { name: "StageName", label: "Stage", required: true },
      { name: "CloseDate", label: "Close Date", type: "date", required: true },
      { name: "Amount", label: "Amount", type: "number" },
      { name: "Description", label: "Description" },
    ],

    Lead: [
      { name: "FirstName", label: "First Name" },
      { name: "LastName", label: "Last Name", required: true },
      { name: "Company", label: "Company", required: true },
      { name: "Email", label: "Email", type: "email" },
      { name: "Phone", label: "Phone" },
    ],

    Contact: [
      { name: "FirstName", label: "First Name" },
      { name: "LastName", label: "Last Name", required: true },
      { name: "Email", label: "Email", type: "email" },
      { name: "Phone", label: "Phone" },
      { name: "Title", label: "Title" },
    ],

    Case: [
      { name: "Subject", label: "Subject" },
      { name: "Status", label: "Status" },
      { name: "Origin", label: "Origin" },
      { name: "Priority", label: "Priority" },
      { name: "Description", label: "Description" },
    ],
  };

  useEffect(() => {
    checkLogin();
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadRecords(objectName);
    }
  }, [loggedIn, objectName]);

  async function checkLogin() {
    try {
      const data = await getAuthStatus();
      setLoggedIn(data.loggedIn);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadRecords(selectedObject) {
    try {
      setLoading(true);

      const data = await getRecords(selectedObject);

      setRecords(data.records || []);
      setNextRecordsUrl(data.nextRecordsUrl || null);
    } catch (error) {
      console.error(error);
      alert("Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(recordId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this record?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      await deleteRecord(objectName, recordId);

      alert("Record deleted successfully");

      await loadRecords(objectName);
    } catch (error) {
      console.error("DELETE ERROR:", error);

      alert(
        "Failed to delete record: " +
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadNextRecords() {
    if (!nextRecordsUrl || loading) {
      return;
    }

    try {
      setLoading(true);

      const data = await getNextRecords(nextRecordsUrl);

      setRecords((previous) => [
        ...previous,
        ...(data.records || []),
      ]);

      setNextRecordsUrl(data.nextRecordsUrl || null);
    } catch (error) {
      console.error(error);
      alert("Failed to load more records");
    } finally {
      setLoading(false);
    }
  }

  function handleScroll(event) {
    const element = event.currentTarget;

    const reachedBottom =
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - 50;

    if (reachedBottom) {
      loadNextRecords();
    }
  }

  // TEST VIEW
  async function handleView(record) {
    try {
      const data = await getRecord(
        objectName,
        record.Id
      );

      setSelectedRecord(data);
    } catch (error) {
      console.error(error);
      alert("Failed to load record: " + error.message);
    }
  }

  async function handleUpdate() {
    if (!editingRecord || !editingRecord.Id) {
      return;
    }

    try {
      setLoading(true);

      const recordId = editingRecord.Id;

      const dataToUpdate = { ...editingRecord };

      delete dataToUpdate.Id;
      delete dataToUpdate.attributes;

      console.log("Updating:", dataToUpdate);

      await updateRecord(
        objectName,
        recordId,
        dataToUpdate
      );

      alert("Record updated successfully");

      setEditingRecord(null);

      await loadRecords(objectName);

    } catch (error) {
      console.error("UPDATE ERROR:", error);

      alert(
        "Failed to update record: " +
        error.message
      );
    } finally {
      setLoading(false);
    }
  }


  async function handleCreate() {
    try {
      setLoading(true);

      const fields = createFields[objectName];

      const dataToCreate = {};

      fields.forEach((field) => {
        const value = newRecord[field.name];

        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          dataToCreate[field.name] = value;
        }
      });

      await createRecord(
        objectName,
        dataToCreate
      );

      alert("Record created successfully");

      setCreatingRecord(false);
      setNewRecord({});

      await loadRecords(objectName);

    } catch (error) {
      console.error("CREATE ERROR:", error);

      alert(
        "Failed to create record: " +
        error.message
      );

    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="app">

      <header className="header">
        <h1>Salesforce CRUD Application</h1>
        <p>Manage your Salesforce records</p>
      </header>

      <div className="container">

        <div className="status-card">
          {loggedIn ? (
            <span className="connected">
              ✅ Salesforce Connected
            </span>
          ) : (
            <button
              className="btn-view"
              onClick={loginWithSalesforce}
            >
              Login with Salesforce
            </button>
          )}
        </div>

        {loggedIn && (
          <>

            <div className="controls">

              <label>
                Select Salesforce Object
              </label>

              <select
                value={objectName}
                onChange={(event) =>
                  setObjectName(event.target.value)
                }
              >
                {objects.map((object) => (
                  <option
                    key={object}
                    value={object}
                  >
                    {object}
                  </option>
                ))}
              </select>

            </div>

            <div className="record-card">
              <div className="record-header">

                <div className="record-title">
                  <h2>
                    {objectName} Records
                  </h2>

                  <button
                    type="button"
                    className="btn-add"
                    onClick={() => {
                      setNewRecord({});
                      setCreatingRecord(true);
                    }}
                  >
                    + Add Record
                  </button>
                </div>

              </div>

              {loading && (
                <div className="loading">
                  Loading...
                </div>
              )}

              {!loading &&
                records.length === 0 && (
                  <div className="empty-state">
                    No records found
                  </div>
                )}

              {!loading &&
                records.length > 0 && (

                  <div
                    className="table-container"
                    onScroll={handleScroll}
                  >

                    <table>

                      <thead>
                        <tr>

                          {Object.keys(records[0])
                            .filter(
                              (field) =>
                                field !== "attributes"
                            )
                            .map((field) => (
                              <th key={field}>
                                {field}
                              </th>
                            ))}

                          <th>
                            Actions
                          </th>

                        </tr>
                      </thead>

                      <tbody>

                        {records.map((record) => (

                          <tr key={record.Id}>

                            {Object.keys(records[0])
                              .filter(
                                (field) =>
                                  field !== "attributes"
                              )
                              .map((field) => (

                                <td key={field}>

                                  {typeof record[field] ===
                                    "object"
                                    ? JSON.stringify(
                                      record[field]
                                    )
                                    : record[field] ?? "-"}

                                </td>

                              ))}

                            <td>
                              <button
                                className="btn-view"
                                type="button"
                                onClick={() => handleView(record)}
                              >
                                View
                              </button>

                              <button
                                className="btn-edit"
                                type="button"
                                onClick={() => setEditingRecord(record)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-delete"
                                type="button"
                                onClick={() => handleDelete(record.Id)}
                              >
                                Delete
                              </button>
                            </td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                )}

            </div>

            {selectedRecord && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 9999,
                }}
              >
                <div
                  style={{
                    background: "white",
                    width: "600px",
                    maxWidth: "90%",
                    maxHeight: "80vh",
                    overflowY: "auto",
                    borderRadius: "10px",
                    padding: "25px",
                  }}
                >
                  <h2 style={{ color: "#032d60" }}>
                    {objectName} Details
                  </h2>

                  {Object.entries(selectedRecord)
                    .filter(([field]) => field !== "attributes")
                    .map(([field, value]) => (
                      <div
                        key={field}
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        <strong>{field}: </strong>

                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : value ?? "-"}
                      </div>
                    ))}

                  <button
                    className="btn-close"
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    style={{
                      marginTop: "20px",
                      padding: "10px 20px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}


            {editingRecord && (
              <div className="edit-overlay">
                <div className="edit-modal">
                  <h2>Edit {objectName}</h2>

                  {Object.entries(editingRecord)
                    .filter(([field]) => field !== "attributes")
                    .map(([field, value]) => (
                      <div
                        key={field}
                        style={{
                          marginBottom: "15px",
                        }}
                      >
                        <label>
                          <strong>{field}</strong>
                        </label>

                        <input
                          type="text"
                          value={
                            typeof value === "object"
                              ? JSON.stringify(value)
                              : value ?? ""
                          }
                          onChange={(event) =>
                            setEditingRecord({
                              ...editingRecord,
                              [field]: event.target.value,
                            })
                          }
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                          }}
                        />
                      </div>
                    ))}

                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-save"
                    onClick={handleUpdate}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {creatingRecord && (
              <div className="create-overlay">

                <div className="create-modal">

                  <h2>
                    Create {objectName}
                  </h2>

                  <p className="create-subtitle">
                    Enter the details to create a new Salesforce record.
                  </p>

                  <div className="create-form">

                    {createFields[objectName].map((field) => (

                      <div
                        className="create-field"
                        key={field.name}
                      >

                        <label>
                          {field.label}

                          {field.required && (
                            <span className="required">
                              *
                            </span>
                          )}
                        </label>

                        <input
                          type={field.type || "text"}
                          value={newRecord[field.name] || ""}
                          required={field.required}
                          onChange={(event) =>
                            setNewRecord({
                              ...newRecord,
                              [field.name]:
                                event.target.value,
                            })
                          }
                        />

                      </div>

                    ))}

                  </div>

                  <div className="create-actions">

                    <button
                      type="button"
                      className="create-cancel"
                      onClick={() => {
                        setCreatingRecord(false);
                        setNewRecord({});
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="create-save"
                      onClick={handleCreate}
                      disabled={loading}
                    >
                      {loading
                        ? "Creating..."
                        : "Create Record"}
                    </button>

                  </div>

                </div>

              </div>
            )}

          </>
        )}

      </div>

    </div>
  );
}

export default App;