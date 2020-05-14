# Getting Started
Install Postgresql (`sudo apt-get install postgresql`)

Create postgres user "postgres" (`sudo -u postgres createuser postgres`)

Create database "lobster" (`sudo -u postgres createdb lobster`)

Optional: Restore from dump (`sudo -u postgres psql lobster < backend/sql/outfile`)

Install python dependencies in requirements.txt (`pip install -r backend/requirements.txt`)

Run start_server script (`./backend/start_server`)

# View Lobster Database
`sudo -u postgres psql lobster`

# API Documentation
http://localhost:8000/api/docs/
