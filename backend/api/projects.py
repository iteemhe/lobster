import backend
from flask import Flask,url_for, render_template,redirect, request
import flask
import time
import requests
import os,binascii

def verify_login(func):
    def wrapper(**kwargs):
        if 'Authorization' not in request.headers:
            return flask.abort(403)
        if request.headers['Authorization'].split(" ")[0] != "Token":
            return flask.abort(403)
        token = request.headers['Authorization'].split(" ")[1]
        cur = backend.conn.cursor()
        cur.execute("SELECT email from users where token = %s",(token,))
        response = cur.fetchone()
        if response == None:
            return flask.abort(403)
        cur.close()
        return func(*kwargs.values(),response[0])
    wrapper.__name__ = func.__name__
    return wrapper

@backend.app.route('/exercises/<exerciseid>/projects/', methods = ['GET'])
@verify_login
def get_exercise_projects(exerciseid,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from projects where exerciseid = %s",(exerciseid,))
    projects = cur.fetchall()
    output = []
    for project in projects:
        output.append({"projectid":project[0],"email":project[1],"sessionid":project[2],"exerciseid":project[3],"lastmodified":project[4]})
    cur.close()
    return flask.jsonify(output)

@backend.app.route('/exercises/<exerciseid>/projects/', methods = ['POST'])
@verify_login
def add_exercise_projects(exerciseid,email):
    cur = backend.conn.cursor()
    
    cur.execute("INSERT INTO projects (email, exerciseid) VALUES (%s,%s) RETURNING projectid",(email,exerciseid))
    projectid = cur.fetchone()[0]
    cur.execute("SELECT * from projects where projectid = %s",[projectid])
    project = cur.fetchone()

    cur.execute("update exercises set numusers = numusers+1 where exerciseid = %s",(exerciseid,))
    backend.conn.commit()

    output = {"projectid":project[0],"email":project[1],"sessionid":project[2],"exerciseid":project[3],"lastmodified":project[4]}
    cur.execute("insert into project_files (projectid, filename, filecontents) select %s,filename,filecontents from starter_files where exerciseid=%s",(projectid,exerciseid))
    backend.conn.commit()
    cur.execute("SELECT * from project_files where projectid = %s",[projectid])
    files = cur.fetchall()
    files = [file[0] for file in files]
    output["files"] = files    
    cur.close()
    return flask.jsonify(output)

@backend.app.route('/projects/<projectid>/', methods = ['GET'])
@verify_login
def get_project(projectid,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from projects where projectid = %s",(projectid,))
    project = cur.fetchone()
    cur.execute("SELECT filename from project_files where projectid = %s",(project[0],))
    files = cur.fetchall()
    files = [file[0] for file in files]
    output = {"projectid":project[0],"email":project[1],"sessionid":project[2],"exerciseid":project[3],"lastmodified":project[4],"files":files}
    cur.close()
    return flask.jsonify(output)
 

@backend.app.route('/projects/<projectid>/', methods = ['DELETE'])
@verify_login
def delete_project(projectid,email):
    cur = backend.conn.cursor()
    cur.execute("delete from projects where projectid = %s",(projectid,))
    backend.conn.commit()
    cur.close()
    return {},204

@backend.app.route('/projects/<projectid>/files/', methods = ['GET'])
@verify_login
def get_project_files(projectid,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT filename from project_files where projectid = %s",(projectid,))
    files = cur.fetchall()
    files = [file[0] for file in files]
    cur.close()
    return flask.jsonify(files)

#TODO: Do I need an endpoint to add or delete files not a part of starter files


@backend.app.route('/projects/<projectid>/files/<filename>/', methods = ['GET'])
@verify_login
def get_project_file(projectid,filename,email):
    cur = backend.conn.cursor()
    print(filename)
    cur.execute("Select filecontents from project_files where projectid = %s and filename = %s",(projectid,filename))
    filecontents = cur.fetchone()[0]
    cur.close()
    return bytes(filecontents),200

@backend.app.route('/projects/<projectid>/files/<filename>/', methods = ['PATCH'])
@verify_login
def edit_project_file(projectid,filename,email):
    cur = backend.conn.cursor()
    file_contents = request.form['file']
    cur.execute("update project_files set filecontents = %s where filename = %s",(file_contents,filename))
    if "status" in request.form:
        cur.execute("update projects set status = %s where projectid = %s",(request.form["status"],projectid))
    backend.conn.commit()
    cur.close()
    return file_contents,201

@backend.app.route('/projects/<projectid>/status/', methods = ['PATCH'])
@verify_login
def edit_project_status(projectid,email):
    cur = backend.conn.cursor()
    cur.execute("update projects set status = %s where projectid = %s",(request.form["status"],projectid))
    backend.conn.commit()
    cur.close()
    return request.form["status"],201

@backend.app.route('/projects/<projectid>/status/', methods = ['GET'])
@verify_login
def get_project_status(projectid,email):
    cur = backend.conn.cursor()
    cur.execute("select status from projects where projectid = %s",(projectid))
    status = cur.fetchone()[0]
    cur.close()
    return status,200