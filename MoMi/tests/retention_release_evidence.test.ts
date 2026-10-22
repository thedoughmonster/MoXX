import assert from "node:assert/strict"
import test from "node:test"
import { readSuccessfulRetentionRun } from "../scripts/release/retention/read_successful_run.ts"

test("evidence requires exact successful repository/workflow/head/jobs, not caller claims", () => {
  for (const kind of ["validation","development"] as const) {
    const run = {repository:{full_name:"thedoughmonster/MoXX"},head_sha:"a".repeat(40),
      path:kind==="validation"?".github/workflows/monorepo-routing.yml":".github/workflows/deploy-dev.yml",
      status:"completed",conclusion:"success",event:kind==="validation"?"pull_request":"workflow_dispatch",
      head_branch:"dev",run_attempt:1}
    const jobs = (kind==="validation"?["selected-backend-validation / validate-final","product-validation"]:["deploy"])
      .map((name)=>({name,status:"completed",conclusion:"success"}))
    const invoke = (value:unknown,jobValues:unknown=jobs) => readSuccessfulRetentionRun(1,"a".repeat(40),kind,
      (_command,args)=>({status:0,stderr:"",stdout:JSON.stringify(args[1].includes("/jobs?")?{jobs:jobValues}:value)}))
    assert.equal(invoke(run).run_attempt,1)
    for (const override of [{repository:{full_name:"untrusted/fork"}}, {head_sha:"b".repeat(40)},
      {path:".github/workflows/unrelated.yml"}, {status:"in_progress"}, {conclusion:"failure"},
      {event:"push"}, {run_attempt:null}]) assert.throws(()=>invoke({...run,...override}))
    assert.throws(()=>invoke(run,[]))
    assert.throws(()=>invoke(run,[...jobs,jobs[0]]))
    assert.throws(()=>invoke(run,jobs.map((job)=>({...job,conclusion:"skipped"}))))
  }
})
