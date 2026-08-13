const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const dotenv = require("dotenv");
const session = require("express-session");
const cors = require("cors");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(
    session({
        secret: process.env.SESSION_SECRET || "salesforce-crud-session-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 60 * 60 * 1000,
        },
    })
);

// Home
app.get("/", (req, res) => {
    res.json({
        message: "Salesforce CRUD Backend is running",
    });
});

// Salesforce Login
app.get("/oauth/login", (req, res) => {
    const state = crypto.randomBytes(32).toString("hex");

    const codeVerifier = crypto.randomBytes(64).toString("base64url");

    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.SALESFORCE_CLIENT_ID,
        redirect_uri: process.env.SALESFORCE_CALLBACK_URL,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
    });

    const authorizationUrl =
        `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/authorize?` +
        params.toString();

    res.redirect(authorizationUrl);
});

// OAuth Callback
app.get("/oauth/callback", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).json({
                error: "Authorization code missing",
            });
        }

        if (!state || state !== req.session.oauthState) {
            return res.status(400).json({
                error: "Invalid OAuth state",
            });
        }

        const codeVerifier = req.session.codeVerifier;

        if (!codeVerifier) {
            return res.status(400).json({
                error: "PKCE code verifier missing",
            });
        }

        const tokenResponse = await axios.post(
            `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`,
            new URLSearchParams({
                grant_type: "authorization_code",
                client_id: process.env.SALESFORCE_CLIENT_ID,
                client_secret: process.env.SALESFORCE_CLIENT_SECRET,
                redirect_uri: process.env.SALESFORCE_CALLBACK_URL,
                code,
                code_verifier: codeVerifier,
            }).toString(),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        req.session.salesforce = {
            accessToken: tokenResponse.data.access_token,
            refreshToken: tokenResponse.data.refresh_token,
            instanceUrl: tokenResponse.data.instance_url,
            issuedAt: Date.now(),
        };

        delete req.session.oauthState;
        delete req.session.codeVerifier;

        res.json({
            message: "Salesforce login successful",
            instanceUrl: tokenResponse.data.instance_url,
        });
    } catch (error) {
        console.error(
            "OAuth Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Salesforce OAuth failed",
            details: error.response?.data || error.message,
        });
    }
});

app.get("/api/auth/status", (req, res) => {
    if (!req.session.salesforce) {
        return res.json({
            loggedIn: false,
        });
    }

    res.json({
        loggedIn: true,
        instanceUrl: req.session.salesforce.instanceUrl,
    });
});

// Get Account records

// Allowed Salesforce objects
const ALLOWED_OBJECTS = [
    "Account",
    "Opportunity",
    "Lead",
    "Contact",
    "Case",
];

// Validate Salesforce object
function validateObject(objectName) {
    return ALLOWED_OBJECTS.includes(objectName);
}

// GET records
// GET first 20 records
app.get("/api/salesforce/:objectName", async (req, res) => {
    try {
        const { objectName } = req.params;

        if (!validateObject(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object",
            });
        }

        if (!req.session.salesforce) {
            return res.status(401).json({
                error: "Not logged in to Salesforce",
            });
        }

        const { accessToken, instanceUrl } = req.session.salesforce;

        let fields;

        switch (objectName) {
            case "Account":
                fields = "Id,Name,Phone,Website,Industry,Type";
                break;

            case "Opportunity":
                fields = "Id,Name,StageName,Amount,CloseDate,Type";
                break;

            case "Lead":
                fields = "Id,FirstName,LastName,Company,Email,Phone";
                break;

            case "Contact":
                fields = "Id,FirstName,LastName,Email,Phone,Title";
                break;

            case "Case":
                fields = "Id,CaseNumber,Subject,Status,Priority,Origin";
                break;
        }

        const soql = `
      SELECT ${fields}
      FROM ${objectName}
      ORDER BY CreatedDate DESC
      LIMIT 20
    `;

        const response = await axios.get(
            `${instanceUrl}/services/data/v66.0/query`,
            {
                params: {
                    q: soql,
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        res.json({
            records: response.data.records,
            totalSize: response.data.totalSize,
            done: response.data.done,
            nextRecordsUrl: response.data.nextRecordsUrl || null,
        });

    } catch (error) {
        console.error(
            "Salesforce GET Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to fetch Salesforce records",
            details: error.response?.data || error.message,
        });
    }
});

// GET next 20 records using Salesforce nextRecordsUrl
app.get("/api/salesforce/next", async (req, res) => {
    try {
        if (!req.session.salesforce) {
            return res.status(401).json({
                error: "Not logged in to Salesforce",
            });
        }

        const { accessToken, instanceUrl } = req.session.salesforce;

        const nextRecordsUrl = req.query.nextRecordsUrl;

        if (!nextRecordsUrl) {
            return res.status(400).json({
                error: "nextRecordsUrl is required",
            });
        }

        // Security check:
        // Only allow Salesforce URLs from the user's own instance.
        if (!nextRecordsUrl.startsWith(instanceUrl)) {
            return res.status(400).json({
                error: "Invalid Salesforce nextRecordsUrl",
            });
        }

        const response = await axios.get(nextRecordsUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.json({
            records: response.data.records,
            totalSize: response.data.totalSize,
            done: response.data.done,
            nextRecordsUrl: response.data.nextRecordsUrl || null,
        });

    } catch (error) {
        console.error(
            "Salesforce NEXT PAGE Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to fetch next Salesforce records",
            details: error.response?.data || error.message,
        });
    }
});


// CREATE record
app.post("/api/salesforce/:objectName", async (req, res) => {
    try {
        const { objectName } = req.params;

        if (!validateObject(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object",
            });
        }

        if (!req.session.salesforce) {
            return res.status(401).json({
                error: "Not logged in to Salesforce",
            });
        }

        const { accessToken, instanceUrl } = req.session.salesforce;

        const response = await axios.post(
            `${instanceUrl}/services/data/v66.0/sobjects/${objectName}`,
            req.body,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        res.status(201).json(response.data);

    } catch (error) {
        console.error(
            "Salesforce CREATE Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to create Salesforce record",
            details: error.response?.data || error.message,
        });
    }
});

// UPDATE record
app.patch("/api/salesforce/:objectName/:recordId", async (req, res) => {
    try {
        const { objectName, recordId } = req.params;

        if (!validateObject(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object",
            });
        }

        if (!req.session.salesforce) {
            return res.status(401).json({
                error: "Not logged in to Salesforce",
            });
        }

        const { accessToken, instanceUrl } = req.session.salesforce;

        await axios.patch(
            `${instanceUrl}/services/data/v66.0/sobjects/${objectName}/${recordId}`,
            req.body,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        res.json({
            success: true,
            message: "Record updated successfully",
            id: recordId,
        });

    } catch (error) {
        console.error(
            "Salesforce UPDATE Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to update Salesforce record",
            details: error.response?.data || error.message,
        });
    }
});


// DELETE record
app.delete("/api/salesforce/:objectName/:recordId", async (req, res) => {
    try {
        const { objectName, recordId } = req.params;

        if (!validateObject(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object",
            });
        }

        if (!req.session.salesforce) {
            return res.status(401).json({
                error: "Not logged in to Salesforce",
            });
        }

        const { accessToken, instanceUrl } = req.session.salesforce;

        await axios.delete(
            `${instanceUrl}/services/data/v66.0/sobjects/${objectName}/${recordId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        res.json({
            success: true,
            message: "Record deleted successfully",
            id: recordId,
        });

    } catch (error) {
        console.error(
            "Salesforce DELETE Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to delete Salesforce record",
            details: error.response?.data || error.message,
        });
    }
});


// GET single record
app.get(
    "/api/salesforce/:objectName/:recordId",
    async (req, res) => {
        try {
            const { objectName, recordId } = req.params;

            if (!validateObject(objectName)) {
                return res.status(400).json({
                    error: "Invalid Salesforce object",
                });
            }

            if (!req.session.salesforce) {
                return res.status(401).json({
                    error: "Not logged in to Salesforce",
                });
            }

            const { accessToken, instanceUrl } =
                req.session.salesforce;

            const response = await axios.get(
                `${instanceUrl}/services/data/v66.0/sobjects/${objectName}/${recordId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            res.json(response.data);

        } catch (error) {
            console.error(
                "Salesforce VIEW Error:",
                error.response?.data || error.message
            );

            res.status(500).json({
                error: "Failed to fetch Salesforce record",
                details: error.response?.data || error.message,
            });
        }
    }
);

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});