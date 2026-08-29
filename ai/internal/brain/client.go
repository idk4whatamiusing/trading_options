// Package brain - HTTP client for the Python trading brain (localhost:8003).
// The Python service owns all trading logic (TradingAgents signal, options
// structuring, risk gates, Alpaca MCP execution) and all persistence
// (writes directly to the Rust db service). This client is a thin
// orchestration/status proxy only.
package brain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	base string
	hc   *http.Client
}

func New(base string) *Client {
	return &Client{base: base, hc: &http.Client{Timeout: 10 * time.Second}}
}

type CycleResult struct {
	CycleID           string   `json:"cycle_id"`
	StartedAt         string   `json:"started_at"`
	FinishedAt        string   `json:"finished_at"`
	TickersEvaluated  int32    `json:"tickers_evaluated"`
	TradesProposed    int32    `json:"trades_proposed"`
	TradesPlaced      int32    `json:"trades_placed"`
	TradesBlocked     int32    `json:"trades_blocked"`
	Errors            []string `json:"errors"`
	Status            string   `json:"status"`
}

func (c *Client) RunCycle(tickers []string) (cycleID, status string, err error) {
	body, _ := json.Marshal(map[string]any{"tickers": tickers})
	resp, err := c.hc.Post(c.base+"/run-cycle", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return "", "", fmt.Errorf("run-cycle: %d", resp.StatusCode)
	}
	var out struct {
		CycleID string `json:"cycle_id"`
		Status  string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", "", err
	}
	return out.CycleID, out.Status, nil
}

func (c *Client) LastCycle() (*CycleResult, error) {
	resp, err := c.hc.Get(c.base + "/last-cycle")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("last-cycle: %d", resp.StatusCode)
	}
	var out CycleResult
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}
